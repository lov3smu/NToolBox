import { log } from '../utils'
import { getConfig } from './config'
import {
  getProvider,
  createProvider,
  getAvailableProviders,
  fetchProviderModels,
  getDefaultProviderModels,
  resolveProviderModels,
  resolveProviderDefaultModel,
  getContextWindow,
  PROVIDER_TYPES,
  PROVIDER_INFO
} from './ai/index.js'
import {
  estimateMessagesTokens,
  estimateToolsTokens,
  estimateTextTokens,
  estimateToolCallsTokens,
  normalizeUsage
} from './ai/tokens.js'
import { getSkillsManager, initSkills } from './skills.js'

const MAX_AGENT_ITERATIONS = 10
const MAX_PLAN_STEPS = 8
const DEFAULT_AGENT_TIMEOUT = 5 * 60 * 1000
const PLANNER_MIN_INPUT_LENGTH = 8

const TERMINATION_TEXT = {
  goal_reached: '目标完成',
  cancelled: '用户停止',
  max_steps: '达到最大轮次',
  timeout: '执行超时',
  error: '执行异常'
}

const EMPTY_LIST_KEYS = [
  'tables',
  'databases',
  'rows',
  'data',
  'items',
  'results',
  'models',
  'list',
  'values',
  'connections'
]

const PLANNER_SYSTEM_PROMPT = `你是任务规划器。根据用户最新请求和可用工具，判断任务复杂度并给出执行计划。
只输出一个 JSON 对象，不要输出任何解释或 Markdown 代码块：
{"complexity":"simple|complex","goal":"一句话描述任务目标","steps":["步骤1","步骤2"]}

规则：
- 闲聊、单次问答、无需工具的请求：complexity=simple，steps=[]
- 一次工具调用即可完成的请求：complexity=simple，steps=[]
- 需要多步工具调用、跨工具协作、或需要先查询再决策的请求：complexity=complex，steps 给出 2-${MAX_PLAN_STEPS} 个可执行步骤
- 每个步骤以动词开头，简短具体，不包含具体工具参数
- 计划只是内部参考，执行过程中可以调整`

const COMPRESSION_DEFAULT_KEEP = 6
const COMPRESSION_MAX_SUMMARY_CHARS = 8000
const COMPRESSION_MAX_INPUT_CHARS = 30000

const COMPRESSION_SYSTEM_PROMPT = `你是对话上下文压缩器。请把历史对话压缩成一段结构化摘要，供后续对话继续使用。
要求：
- 保留用户目标、已确认的事实与数据、已执行的操作与结果、未解决的问题
- 保留关键参数：数据库连接名、库名、表名、文件路径、配置项等
- 使用简洁的 Markdown 列表，合并重复信息
- 不编造对话中不存在的结论或数据
- 只输出摘要正文，不要额外解释，控制在 800 字以内`

const CHAT_ONLY_SYSTEM_PROMPT = `你是一个智能助手，可以帮助用户完成各种开发相关的任务。
当前为仅对话模式：不要调用任何工具，直接根据你的知识回答用户问题。
如果不确定或需要实时数据，请明确说明。回答使用 Markdown 格式。`

const SYSTEM_PROMPT = `你是一个智能助手，可以帮助用户完成各种开发相关的任务。

**重要：必须使用工具调用机制**
- 当需要执行操作（如生成SQL、连接数据库、查询数据等）时，必须通过 function calling 调用工具
- 不要在回复文本中描述工具调用，不要写"[调用 xxx 工具]"这样的文字
- 直接调用对应的工具函数，系统会自动执行并返回结果
- 示例：用户要创建字典 → 调用 dictionary-sql 工具（通过 tool_calls），而不是在文本中写 JSON

**禁止伪造数据规则（强制执行）**：
- 数据库查询必须返回真实数据，绝对禁止伪造、模拟、虚构任何数据
- 如果tool返回失败（success=false），必须告诉用户失败，不能自己生成虚假数据
- 如果tool返回空结果（如"表列表0个"），如实告知用户，不能自己虚构表名
- 如果tool返回error，必须展示真实的error内容，不能掩盖错误
- **错误示例**：tool返回"查询失败：表不存在"，AI错误回复"表结构：users (id, name...)"（伪造）
- **正确示例**：tool返回"查询失败：表不存在"，AI正确回复"查询失败：表不存在，请检查表名是否正确"
- 绝对不要在tool返回失败时，自己编造表名、字段名、数据内容等虚假信息

**安全规则（强制执行）**：
- 数据库操作必须返回真实数据，禁止伪造或模拟数据
- SQL查询安全限制：只允许执行查询类语句
  ✓ 允许：SELECT、SHOW、DESCRIBE、DESC、EXPLAIN
  ✗ 禁止：INSERT、UPDATE、DELETE、DROP、ALTER、CREATE、TRUNCATE
- 用户请求执行禁止的SQL语句时，拒绝执行并说明安全限制
- 示例：用户说"删除users表数据" → 拒绝执行，回复"安全限制：禁止执行DELETE语句，只允许查询操作"

语义理解核心规则：
- 从用户自然语言中识别意图，自动选择正确的工具和参数
- 识别关键词：连接、查看、查询、表结构、数据库等
- 自动提取参数：连接名、数据库名、表名、SQL语句、数量限制等
- 参数补全：从对话上下文获取之前使用的连接名、数据库名
- 工作流记忆：记住用户当前连接的数据库和操作上下文
- 主动询问：当缺少必要参数时，主动询问用户而非猜测

**复合操作编排规则（强制执行）**：
- 复合操作定义：用户输入包含多个操作意图（如"连接xxx查询yyy"）
- 调用链顺序：按语义顺序自动编排工具调用序列
- 参数传递机制：前一个工具的输出作为下一个工具的输入参数
- 上下文记忆：记住每个步骤的执行结果，用于后续步骤参数补全
- 错误中断：前一步失败时，不执行后续步骤，向用户报告错误

**复合操作示例编排**：
示例1："连接到mysql57查询order_db有哪些表"
调用链编排：
步骤1：db-connect({action: "connect", connection_name: "mysql57"})
  → 记住connection_name="mysql57"用于后续步骤
步骤2：db-query({action: "list_tables", connection_name: "mysql57", database: "order_db"})
  → connection_name从步骤1获取，database从输入提取"order_db"
返回：order_db的真实表列表

示例2："连接mysql57，查看user_db的users表结构"
调用链编排：
步骤1：db-connect({action: "connect", connection_name: "mysql57"})
  → 记住connection_name="mysql57"
步骤2：db-schema({action: "describe", connection_name: "mysql57", database: "user_db", table_name: "users"})
  → 参数自动补全
返回：users表的真实结构信息

示例3："连接mysql57，查看有哪些数据库，然后查看order_db的表"
调用链编排：
步骤1：db-connect({action: "connect", connection_name: "mysql57"})
步骤2：db-query({action: "list_databases", connection_name: "mysql57"})
步骤3：db-query({action: "list_tables", connection_name: "mysql57", database: "order_db"})
返回：数据库列表 + 表列表

回复格式规则：
- 在执行复杂任务前，先在<thinking>标签中输出你的思考过程
- 思考过程应包含：分析用户需求、选择合适工具、规划执行步骤、参数准备
- 思考内容要详细，不要只写开头几个字就停止
- **重要：思考结束后直接调用工具函数，不要在文本中描述工具调用**
- 简单问题不需要思考过程，直接回复

示例格式：
<thinking>
分析用户需求：用户想要生成字典配置SQL脚本。
选择工具：dictionary-sql 工具。
准备参数：dict_name="用户状态", dict_values=[正常, 禁用, 已删除]
</thinking>
[然后直接调用 dictionary-sql 工具，不要在文本中写任何关于调用工具的内容]

可用 Skills（技能）：
数据库类：
- db-connect - 连接数据库（列出连接、测试连接、创建连接、断开连接、查看状态）
- db-query - 数据库查询（查询数据库列表、查询表列表、执行SQL语句）
- db-schema - 表结构查询（表结构描述、建表语句、索引信息、字段详情）
- dictionary-sql - 生成字典配置SQL（自动翻译中文到英文编码）
- function-group-sql - 生成功能权限组SQL（自动翻译中文到大驼峰编码）
- sql-script - 生成SQL脚本文件
- sql-optimize - 优化SQL查询性能
- sql-config - 获取SQL脚本配置信息

代码类：
- code-review - 审查代码质量、安全性、性能
- code-generate - 根据需求生成代码
- api-design - 设计RESTful API规范

文档类：
- doc-generate - 为代码生成文档说明

工具类：
- password - 生成随机密码
- timestamp - 时间戳与日期互转
- cron - 生成Cron表达式
- json-format - 格式化/验证JSON
- yaml-validate - 验证YAML格式

重要规则：
- 执行工具后，必须检查返回结果中的 success 字段
- 如果 success=true，告诉用户成功，并展示文件路径和关键信息
- 如果 success=false，必须告诉用户失败，并说明具体的 error 内容，不能说"已成功生成"
- 绝对不要在工具返回失败时回复"已成功"、"已完成"等虚假成功信息

数据库连接语义识别规则：
- 触发关键词："连接"、"数据库"、"查看连接"、"断开"、"关闭"、"测试"
- 语义→Action映射：
  * "连接数据库"或"查看连接"或"有哪些连接" → action: "list"
  * "连接到xxx"或"连接xxx数据库"或"使用xxx连接" → action: "connect", connection_name从xxx提取
  * "断开xxx"或"关闭xxx连接"或"断开连接" → action: "disconnect", connection_name从xxx提取或从上下文获取
  * "测试xxx连接"或"测试连接" → action: "test", connection_name从xxx提取或从上下文获取
  * "查看连接状态"或"是否已连接" → action: "status"
- 参数提取规则：
  * connection_name：从用户输入提取，如"连接到mysql57"提取"mysql57"；未指定时从上下文获取
- 工作流：
  * 用户首次提到连接时，先执行list查看可用连接，然后询问"请选择要连接的数据库"
  * 用户指定连接名后，执行connect建立连接
  * 连接成功后记住connection_name，后续查询时自动使用此连接名

数据库查询语义识别规则：
- **复合操作识别**：用户输入包含"连接xxx查询yyy"时，自动编排调用链
  * 步骤1：识别连接意图 → db-connect连接指定数据库
  * 步骤2：识别查询意图 → db-query查询指定数据
  * 参数传递：connection_name从步骤1获取，database从输入提取
  
- **强制触发**：用户输入包含以下任一关键词组合时，立即调用db-query工具：
  * "查看表" + 数据库名（如"查看order_db的表"、"order_db有哪些表"）
  * "查看数据库" 或 "有哪些数据库"（如"查看有哪些数据库"、"数据库列表"）
  * "查询数据" + SQL关键词（如"查询用户数据"、"SELECT"）

数据库查询语义识别规则：
- **强制触发**：用户输入包含以下任一关键词组合时，立即调用db-query工具：
  * "查看表" + 数据库名（如"查看order_db的表"、"order_db有哪些表"）
  * "查看数据库" 或 "有哪些数据库"（如"查看有哪些数据库"、"数据库列表"）
  * "查询数据" + SQL关键词（如"查询用户数据"、"SELECT"）
  
- **优先级规则**：
  1. 用户说"查看xxx库的表"或"xxx库有哪些表" → **强制调用** db-query({action: "list_tables", database: "xxx", connection_name从上下文获取})
  2. 用户说"查看有哪些数据库" → **强制调用** db-query({action: "list_databases"})
  3. 用户说"查询xxx表数据" → **强制调用** db-query({action: "execute", sql自动生成})
  
- 触发关键词："查看"、"数据库"、"表"、"查询"、"SELECT"、"执行SQL"、"数据"
- 语义→Action映射：
  * "查看数据库"或"有哪些数据库"或"数据库列表" → action: "list_databases"
  * **重要**："查看表"或"有哪些表"或"查看xxx库的表"或"xxx库有哪些表" → action: "list_tables"，database必须从xxx提取
  * "查询数据"或"执行SQL"或"SELECT"或"查询xxx数据" → action: "execute"
  
- 参数提取规则：
  * connection_name：必须参数，从对话上下文获取（之前连接的数据库）；无活跃连接时提示"请先连接数据库"
  * **database提取**：
    - 用户说"查看order_db的表" → 提取database="order_db"
    - 用户说"order_db有哪些表" → 提取database="order_db"
    - 用户说"查看user_db中的表" → 提取database="user_db"
    - 用户只说"查看表"未指定数据库 → 询问"请指定数据库，如order_db或user_db"
  * sql：根据用户意图生成SQL语句，遵循SQL生成规则
  * limit：从用户输入提取数量，如"查询前10条"提取limit=10；默认1000
  
- SQL生成规则：
  * "查询xxx表数据" → SELECT * FROM xxx
  * "查询前N条" → SELECT * FROM xxx LIMIT N
  * "查询xxx为yyy的数据" → SELECT * FROM xxx WHERE field='yyy'
  * "查询xxx表的字段A和B" → SELECT A, B FROM xxx
  
- 工作流：
  * 查询前检查是否有活跃连接（从对话上下文获取connection_name）
  * **立即触发**：用户输入匹配触发关键词时，立即调用工具，不要犹豫或等待
  * 未指定database时，先询问"请指定要查询的数据库"

表结构查询语义识别规则：
- 触发关键词："表结构"、"字段"、"索引"、"建表语句"、"CREATE TABLE"、"Schema"
- 语义→Action映射：
  * "查看表结构"或"查看xxx表结构"或"表的结构"或"有哪些字段" → action: "describe"
  * "查看建表语句"或"CREATE语句"或"建表SQL" → action: "show_create"
  * "查看索引"或"有哪些索引"或"表的索引" → action: "show_indexes"
  * "查看字段详情"或"字段注释"或"完整字段信息" → action: "show_columns"
- 参数提取规则：
  * connection_name：必须参数，从对话上下文获取；无活跃连接时提示"请先连接数据库"
  * database：从用户输入提取，如"查看user_db的users表结构"提取"user_db"；从上下文获取当前数据库
  * table_name：必须参数，从用户输入提取，如"查看users表结构"提取"users"；未指定时询问"请指定表名"
- 工作流：
  * 查询前检查是否有活跃连接
  * 用户说"查看表结构"未指定具体表时，询问"请指定要查看的表名"
  * 用户已切换到某个数据库时，database参数从上下文自动补全
- 示例：用户说"查看users表的表结构"
  调用：db-schema({action: "describe", connection_name: "mysql57", database: "user_db", table_name: "users"})

字典配置生成规则：
- 当用户请求生成字典配置时，使用 dictionary-sql Skill
- **支持批量模式**：用户请求多个字典时，使用 dict_list 参数一次性生成
- dict_list: 字典列表数组，每项包含 dict_name 和 dict_values
- dict_values: 字典值列表，每个值包含 name（中文）和可选的 sort、status
- 工具会自动将中文翻译成英文编码（全大写）作为 dict_value 和 dict_data_value
- database: 默认使用 main_db（字典管理表所在库），除非用户明确指定其他库
- dir_name: 用户指定的目录名（如"0424-电商V2.0"），必须从输入提取
- merge_strategy: 文件合并策略（可选）
  - auto: 自动分析语境决定（默认）
  - separate: 每个字典单独一个文件
  - merge: 所有字典合并到一个文件
- **强制触发**：用户输入包含"字典"、"字典配置"、"生成字典"等关键词时，立即调用工具
- **重要：直接调用工具函数，不要在回复文本中写参数或描述调用过程**
- 示例：用户说"创建字典放到0424-电商V2.0，订单状态：待付款、已付款；物流状态：待发货、已发货"
  → 直接调用 dictionary-sql({dict_list:[{dict_name:"订单状态",dict_values:[{name:"待付款"},{name:"已付款"}]},{dict_name:"物流状态",dict_values:[{name:"待发货"},{name:"已发货"}]}],dir_name:"0424-电商V2.0"})
- **批量模式优先**：当用户一次请求多个字典时，使用 dict_list 参数，不要多次调用

功能权限组生成规则：
- 当用户请求生成功能权限组时，使用 function-group-sql Skill
- app_group: 应用代码，如 "EBL"、"ORDER"
- function_groups: 功能权限组列表，最多三级
  - level: 层级（1顶级，2二级，3三级）
  - code/name: 中文名称，会自动翻译成大驼峰编码
  - parent_code: 父级编码（仅二级和三级需要，顶级不填）
  - sort: 排序（可选，顶级默认10，二级三级自动计算）
  - functions: 功能权限列表
    - code/name: 中文名称，会自动翻译成大驼峰编码
    - is_sensitive: 是否敏感（可选，默认0）
    - sort: 排序（可选，默认0）
    - status: 状态（可选，默认101001）
- database: 默认使用 user_db（功能权限表所在库）
- 示例：用户说"生成功能权限：应用EBL，顶级组-订单管理，包含功能-订单列表、订单详情"
  调用：function-group-sql({
    app_group: "EBL",
    function_groups: [{
      level: 1,
      code: "订单管理",
      name: "订单管理",
      sort: 10,
      functions: [
        {code: "订单列表", name: "订单列表"},
        {code: "订单详情", name: "订单详情"}
      ]
    }],
    database: "user_db"
  })

语义理解示例：
用户: "连接到mysql57查询order_db有哪些表"
<thinking>
语义分析：用户输入包含复合操作意图："连接mysql57" + "查询order_db有哪些表"
复合操作编排：
步骤1：识别连接意图 → db-connect连接mysql57
步骤2：识别查询意图 → db-query查询order_db的表列表
参数提取：connection_name="mysql57"，database="order_db"
上下文传递：步骤1成功后，connection_name传递给步骤2
执行顺序：先连接，再查询，返回真实表列表
</thinking>
步骤1: db-connect({action: "connect", connection_name: "mysql57"})
步骤2: db-query({action: "list_tables", connection_name: "mysql57", database: "order_db"})
**注意：如果步骤2返回空列表或失败，如实告知用户，不伪造表名**

用户: "连接到mysql57查看user_db的users表结构"
<thinking>
语义分析：复合操作："连接mysql57" + "查看users表结构"
调用链编排：
步骤1：db-connect → connection_name="mysql57"
步骤2：db-schema → table_name="users"，database="user_db"
参数传递：connection_name从步骤1获取
</thinking>
步骤1: db-connect({action: "connect", connection_name: "mysql57"})
步骤2: db-schema({action: "describe", connection_name: "mysql57", database: "user_db", table_name: "users"})
**注意：如果步骤2返回"表不存在"，如实告知用户"表不存在"，不伪造字段结构**

**真实数据处理示例**：
场景1：查询成功返回真实数据
Tool返回：{success: true, tables: ["orders", "products"]}
正确回复："查询成功，order_db包含以下表：orders, products"

场景2：查询成功但无数据
Tool返回：{success: true, tables: []}
正确回复："查询成功，但order_db当前没有任何表"
错误回复："order_db包含orders、products等表"（伪造）

场景3：查询失败
Tool返回：{success: false, error: "数据库不存在"}
正确回复："查询失败：数据库不存在，请检查数据库名称"
错误回复："order_db包含以下表：..."（掩盖错误并伪造）

场景4：表不存在
Tool返回：{success: false, error: "表users不存在"}
正确回复："查询失败：表users不存在，请检查表名是否正确"
错误回复："users表结构：id INT, name VARCHAR..."（伪造）

用户: "我想连接数据库查看数据"
<thinking>
语义分析：用户提到"连接数据库"，触发db-connect工具。
意图识别：用户未指定具体连接名，应先列出可用连接。
参数准备：action="list"，无需其他参数。
执行步骤：返回连接列表后，询问用户选择。
</thinking>
你应该调用: db-connect({action: "list"})
然后回复: "我找到了以下可用的数据库连接，请选择您要连接的数据库：mysql57或127.0.0.1"

用户: "连接到mysql57数据库"
<thinking>
语义分析：用户说"连接到mysql57"，提取连接名为"mysql57"。
意图识别：建立连接，action="connect"。
参数准备：connection_name从输入提取为"mysql57"。
</thinking>
你应该调用: db-connect({action: "connect", connection_name: "mysql57"})

用户: "查看有哪些数据库"
<thinking>
语义分析：用户说"查看数据库"，触发db-query工具。
意图识别：查询数据库列表，action="list_databases"。
上下文记忆：之前已连接mysql57，connection_name从上下文获取。
参数准备：connection_name="mysql57"（从对话历史获取）。
</thinking>
你应该调用: db-query({action: "list_databases", connection_name: "mysql57"})

用户: "查看order_db有哪些表"
<thinking>
语义分析：用户说"查看order_db有哪些表"，包含关键词"查看表"和数据库"order_db"。
强制触发：匹配"xxx库有哪些表"模式，立即调用db-query工具。
意图识别：查询表列表，action="list_tables"。
参数提取：从输入直接提取database="order_db"。
上下文记忆：之前已连接mysql57，connection_name从对话历史获取为"mysql57"。
立即执行：不要犹豫，直接调用工具。
</thinking>
你应该调用: db-query({action: "list_tables", connection_name: "mysql57", database: "order_db"})

用户: "查看user_db中的表"
<thinking>
语义分析：用户说"查看user_db中的表"，包含关键词"查看表"和数据库"user_db"。
强制触发：匹配"查看xxx库的表"模式，立即调用db-query工具。
意图识别：查询表列表，action="list_tables"。
参数提取：从输入提取database="user_db"。
上下文记忆：connection_name="mysql57"。
</thinking>
你应该调用: db-query({action: "list_tables", connection_name: "mysql57", database: "user_db"})

用户: "查看user_db有哪些表"
<thinking>
语义分析：用户说"查看user_db有哪些表"，匹配触发模式。
强制触发：立即调用db-query工具，action="list_tables"。
参数提取：database="user_db"，connection_name="mysql57"。
</thinking>
你应该调用: db-query({action: "list_tables", connection_name: "mysql57", database: "user_db"})

用户: "查看users表的结构"
<thinking>
语义分析：用户说"查看users表结构"，触发db-schema工具。
意图识别：查看表结构，action="describe"。
参数提取：table_name="users"，database从上下文获取为"user_db"，connection_name为"mysql57"。
</thinking>
你应该调用: db-schema({action: "describe", connection_name: "mysql57", database: "user_db", table_name: "users"})

用户: "查询users表前10条数据"
<thinking>
语义分析：用户说"查询users表前10条"，触发db-query工具。
意图识别：执行SQL查询，action="execute"。
参数提取：table_name="users"，limit=10，从上下文获取database="user_db"，connection_name="mysql57"。
SQL生成："SELECT * FROM users LIMIT 10"。
</thinking>
你应该调用: db-query({action: "execute", connection_name: "mysql57", sql: "SELECT * FROM user_db.users LIMIT 10", limit: 10})

用户: "帮我生成一个SQL脚本，数据库是order_db，类型是DDL，用途是添加用户表"
<thinking>
语义分析：用户要生成SQL脚本文件，触发sql-script工具。
参数提取：database="order_db"，script_type="DDL"，usage="添加用户表"。
默认推断：operate_type="PUBLISH"（发布脚本）。
</thinking>
你应该调用: sql-script({database: "order_db", operate_type: "PUBLISH", script_type: "DDL", dir_name: "添加用户表", usage: "添加用户表"})

错误处理示例：
工具返回: {success: false, error: "缺少应用代码"}
正确回复: "生成失败：缺少应用代码，请提供应用代码参数"
错误回复（绝对不要）: "已成功生成SQL脚本"

工具返回: {success: true, filename: "S01-xxx.sql", file_path: "/path/to/file.sql"}
正确回复: "已成功生成SQL脚本 S01-xxx.sql，文件路径：/path/to/file.sql"`

async function getAllToolDefinitions() {
  await initSkills()

  const skillsManager = getSkillsManager()
  return skillsManager.getToolDefinitions()
}

async function executeToolCall(name, args) {
  try {
    const params = typeof args === 'string' ? JSON.parse(args) : args
    log.info('执行工具调用:', name, '参数:', params)

    const skillsManager = getSkillsManager()
    const skill = skillsManager.getSkill(name)

    if (skill) {
      log.info('调用 Skill:', name)
      return await skillsManager.executeSkill(name, params)
    }

    return { success: false, error: `未知工具: ${name}` }
  } catch (e) {
    log.error('工具执行失败:', e)
    return { success: false, error: `工具执行失败: ${e.message}` }
  }
}

function extractLastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== 'user') continue
    if (typeof message.content === 'string') return message.content
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part) => part && part.type === 'text')
        .map((part) => part.text || '')
        .join('\n')
    }
    return ''
  }
  return ''
}

function sanitizePlanText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parsePlannerJson(content) {
  if (typeof content !== 'string' || !content.trim()) return null
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const text = fenced ? fenced[1] : content
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((step) => sanitizePlanText(typeof step === 'string' ? step : step?.title, 120))
        .filter(Boolean)
        .slice(0, MAX_PLAN_STEPS)
    : []
  if (steps.length === 0) return null
  return {
    complexity: raw.complexity === 'complex' ? 'complex' : 'simple',
    goal: sanitizePlanText(raw.goal, 160) || steps[0],
    steps
  }
}

async function generatePlan(provider, messages, tools, options = {}) {
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false
  const text = extractLastUserText(messages)
  if (!text || text.trim().length < PLANNER_MIN_INPUT_LENGTH || shouldStop()) return null

  const toolList = (tools || [])
    .map((tool) => {
      const fn = tool?.function || tool
      const name = fn?.name
      if (!name) return ''
      const description = String(fn?.description || '')
        .split('\n')[0]
        .slice(0, 60)
      return `- ${name}${description ? `：${description}` : ''}`
    })
    .filter(Boolean)
    .join('\n')

  const summaryBlock = buildContextSummaryBlock(options.contextSummary)
  const plannerMessages = [
    { role: 'system', content: `${PLANNER_SYSTEM_PROMPT}${summaryBlock}` },
    {
      role: 'user',
      content: `用户请求：${text.slice(0, 4000)}\n\n可用工具：\n${toolList || '（无）'}`
    }
  ]

  try {
    const planResult = await provider.chat(plannerMessages, [], {
      model: options.model,
      max_tokens: 600,
      temperature: 0.2
    })

    if (!planResult?.success) {
      log.warn('生成执行计划失败:', planResult?.error)
      return null
    }
    if (shouldStop()) return null

    return {
      plan: normalizePlan(parsePlannerJson(planResult.content)),
      usage: planResult.usage,
      messages: plannerMessages,
      content: planResult.content
    }
  } catch (error) {
    log.warn('生成执行计划异常:', error.message)
    return null
  }
}

function createAgentState(plan, options = {}) {
  const timeout = Number(options.agentTimeout) > 0 ? Number(options.agentTimeout) : DEFAULT_AGENT_TIMEOUT
  const startedAt = Date.now()
  return {
    plan,
    timeout,
    startedAt,
    deadline: startedAt + timeout,
    iterations: 0,
    toolCalls: 0,
    toolSuccess: 0,
    toolFailed: 0,
    emptyResults: 0,
    toolNames: [],
    reflections: [],
    termination: null,
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      calls: 0,
      contextTokens: 0,
      estimated: false
    }
  }
}

function recordUsage(state, rawUsage, messages, tools, output) {
  if (!state) return
  const usage = state.usage
  const normalized = normalizeUsage(rawUsage)
  const promptTokens = normalized?.prompt_tokens ?? estimateMessagesTokens(messages) + estimateToolsTokens(tools)
  const completionTokens =
    normalized?.completion_tokens ?? estimateTextTokens(output?.content) + estimateToolCallsTokens(output?.tool_calls)

  usage.prompt_tokens += promptTokens
  usage.completion_tokens += completionTokens
  usage.total_tokens += normalized?.total_tokens ?? promptTokens + completionTokens
  usage.calls += 1
  usage.contextTokens = promptTokens
  if (!normalized) usage.estimated = true
}

function usageSnapshot(usage) {
  return { ...usage }
}

function buildContextSummaryBlock(contextSummary) {
  if (typeof contextSummary !== 'string') return ''
  const summary = contextSummary.trim()
  if (!summary) return ''
  return `\n\n**历史对话摘要（已压缩，供你保持上下文；如与最新消息冲突，以最新消息为准）**：\n${summary}`
}

function buildSystemPrompt(toolsEnabled, contextSummary) {
  const base = toolsEnabled ? SYSTEM_PROMPT : CHAT_ONLY_SYSTEM_PROMPT
  return `${base}${buildContextSummaryBlock(contextSummary)}`
}

function isEmptyToolResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false
  return EMPTY_LIST_KEYS.some((key) => Array.isArray(result[key]) && result[key].length === 0)
}

function reflectOnToolResult(name, result) {
  if (!result || result.success === false) {
    const detail = String(result?.error || '未知错误')
      .replace(/\s+/g, ' ')
      .slice(0, 200)
    return {
      status: 'error',
      text: `${name} 执行失败：${detail}`,
      suggestion: '请检查参数是否正确，或改用其他工具/方式重试，不要编造结果。'
    }
  }
  if (isEmptyToolResult(result)) {
    return {
      status: 'warning',
      text: `${name} 返回空结果`,
      suggestion: '请确认查询条件或参数是否准确；如仍为空，请如实告知用户，不要编造数据。'
    }
  }
  return null
}

function buildAgentSummary(state, result) {
  const termination =
    state.termination || (result?.cancelled ? 'cancelled' : result?.success ? 'goal_reached' : 'error')
  const limitations = []
  if (state.toolFailed > 0) limitations.push(`${state.toolFailed} 次工具调用失败，结果可能不完整`)
  if (state.emptyResults > 0) limitations.push(`${state.emptyResults} 次工具返回空结果，请核实查询条件`)
  if (termination === 'timeout') limitations.push('执行超过时长上限被终止，计划可能未全部完成')
  if (termination === 'max_steps') limitations.push('执行达到最大轮次被终止，计划可能未全部完成')
  if (termination === 'cancelled') limitations.push('用户手动停止，结果可能不完整')
  if (termination === 'error') limitations.push('执行过程发生错误，回答可能不完整')
  if (state.toolCalls === 0 && state.plan) limitations.push('未调用工具，结论基于模型已有知识')

  return {
    termination,
    terminationText: TERMINATION_TEXT[termination] || '已结束',
    duration: Date.now() - state.startedAt,
    goal: state.plan?.goal || '',
    plannedSteps: state.plan?.steps || [],
    iterations: state.iterations,
    toolCalls: state.toolCalls,
    toolSuccess: state.toolSuccess,
    toolFailed: state.toolFailed,
    tools: state.toolNames,
    limitations
  }
}

function getProviderConfig(providerTypeArg) {
  const config = getConfig()
  const providerType = providerTypeArg || config.ai_provider || 'bailian'
  const apiKeys = config.ai_api_keys || {}

  const endpointId = providerType === 'volcengine' ? apiKeys.volcengine_endpoint_id || '' : ''

  const providerConfig = {
    apiKey: apiKeys[providerType] || '',
    timeout: config.ai_timeout ? config.ai_timeout * 1000 : 60000,
    connectionTimeout: config.ai_connection_timeout ? config.ai_connection_timeout * 1000 : 10000,
    models: resolveProviderModels(providerType, config.ai_models),
    defaultModel: resolveProviderDefaultModel(providerType, config.ai_models, endpointId)
  }

  if (providerType === 'minimax') {
    providerConfig.groupId = apiKeys.minimax_group_id || ''
  }
  if (providerType === 'volcengine') {
    providerConfig.endpointId = endpointId
  }

  return { providerType, providerConfig }
}

function summarizeToolResult(result) {
  if (result === undefined || result === null) return ''
  try {
    const text = typeof result === 'string' ? result : JSON.stringify(result)
    return text.length > 4000 ? `${text.slice(0, 4000)}…` : text
  } catch {
    return String(result)
  }
}

async function chatWithToolsInternal(messages, options = {}, iteration = 0) {
  const { providerType, providerConfig } = getProviderConfig(options.provider)
  const provider = getProvider(providerType, providerConfig)

  if (!provider) {
    return { success: false, error: `未知的 AI Provider: ${providerType}` }
  }

  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}，请在设置中配置` }
  }

  if (iteration >= MAX_AGENT_ITERATIONS) {
    return { success: false, error: `已达到最大执行轮次（${MAX_AGENT_ITERATIONS}），已停止自动循环` }
  }

  log.debug(`[chatWithTools] provider=${provider.name} messages=${messages.length}`)

  const model = options.model || provider.getDefaultModel()
  const toolsEnabled = options.toolsEnabled !== false
  const allTools = toolsEnabled ? await getAllToolDefinitions() : []

  const result = await provider.chat(messages, allTools, { model, ...options })

  if (!result.success) return result

  if (result.tool_calls && result.tool_calls.length > 0) {
    log.debug(`[chatWithTools] tool_calls=${result.tool_calls.length}`)

    messages.push({
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.tool_calls
    })

    for (const call of result.tool_calls) {
      log.debug(`执行工具: ${call.function.name}`)
      const toolResult = await executeToolCall(call.function.name, call.function.arguments)
      log.debug(`工具执行结果: ${toolResult.success ? 'success' : 'failed'}`)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolResult)
      })
    }

    return await chatWithToolsInternal(messages, { model, ...options }, iteration + 1)
  }

  return result
}

async function chatWithTools(messages, options = {}) {
  const systemPrompt = buildSystemPrompt(options.toolsEnabled !== false, options.contextSummary)
  const messagesWithSystem = [{ role: 'system', content: systemPrompt }, ...messages]

  return chatWithToolsInternal(messagesWithSystem, options)
}

export async function chat(messages, options = {}) {
  return chatWithTools(messages, options)
}

export async function chatStream(messages, options = {}, onChunk) {
  const { providerType, providerConfig } = getProviderConfig(options.provider)
  const provider = getProvider(providerType, providerConfig)

  if (!provider) {
    return { success: false, error: `未知的 AI Provider: ${providerType}` }
  }

  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}，请在设置中配置` }
  }

  const toolsEnabled = options.toolsEnabled !== false
  const systemPrompt = buildSystemPrompt(toolsEnabled, options.contextSummary)
  const messagesWithSystem = [{ role: 'system', content: systemPrompt }, ...messages]

  const model = options.model || provider.getDefaultModel()
  const allTools = toolsEnabled ? await getAllToolDefinitions() : []

  if (typeof options.shouldStop === 'function' && options.shouldStop()) {
    return { success: false, cancelled: true, content: '', error: '已停止' }
  }

  const planResult = toolsEnabled
    ? await generatePlan(provider, messages, allTools, {
        model,
        shouldStop: options.shouldStop,
        contextSummary: options.contextSummary
      })
    : null
  const state = createAgentState(planResult?.plan || null, options)

  if (planResult) {
    recordUsage(state, planResult.usage, planResult.messages, [], { content: planResult.content })
    if (onChunk) onChunk({ kind: 'usage', usage: usageSnapshot(state.usage) })
  }
  if (state.plan && onChunk) onChunk({ kind: 'plan', plan: state.plan })

  const result = await chatStreamInternal(provider, messagesWithSystem, allTools, { model, ...options }, onChunk, state)

  if (!state.termination) {
    state.termination = result?.cancelled ? 'cancelled' : result?.success ? 'goal_reached' : 'error'
  }

  const summary = buildAgentSummary(state, result)
  const shouldSummarize = Boolean(state.plan) || state.toolCalls > 0 || state.termination !== 'goal_reached'
  if (shouldSummarize && onChunk) onChunk({ kind: 'summary', summary })

  return {
    ...result,
    termination: state.termination,
    summary: shouldSummarize ? summary : undefined,
    plan: state.plan,
    reflections: state.reflections,
    usage: usageSnapshot(state.usage),
    contextWindow: getContextWindow(providerType)
  }
}

async function chatStreamInternal(provider, messages, tools, options, onChunk, state, iteration = 0) {
  const model = options.model || provider.getDefaultModel()
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false

  if (shouldStop()) {
    state.termination = 'cancelled'
    return { success: false, cancelled: true, content: '', error: '已停止' }
  }

  if (Date.now() >= state.deadline) {
    const error = `已超过单次任务时长上限（${Math.round(state.timeout / 1000)} 秒），已停止执行`
    state.termination = 'timeout'
    if (onChunk) onChunk({ kind: 'status', text: error })
    return { success: false, error }
  }

  if (iteration >= MAX_AGENT_ITERATIONS) {
    const error = `已达到最大执行轮次（${MAX_AGENT_ITERATIONS}），已停止自动循环`
    state.termination = 'max_steps'
    if (onChunk) onChunk({ kind: 'status', text: error })
    return { success: false, error }
  }

  state.iterations = iteration + 1

  log.debug(`[chatStream] provider=${provider.name} messages=${messages.length} iteration=${iteration}`)

  const result = await provider.chatStream(messages, tools, { model, ...options }, (event) => {
    if (onChunk) onChunk(event)
  })

  recordUsage(state, result?.usage, messages, tools, result)
  if (onChunk) onChunk({ kind: 'usage', usage: usageSnapshot(state.usage) })

  if (!result.success) return result

  if (result.tool_calls && result.tool_calls.length > 0) {
    log.debug(`[chatStream] tool_calls=${result.tool_calls.length}`)

    messages.push({
      role: 'assistant',
      content: result.content || '',
      tool_calls: result.tool_calls
    })

    for (const call of result.tool_calls) {
      if (shouldStop()) {
        state.termination = 'cancelled'
        return { success: false, cancelled: true, content: result.content || '', error: '已停止' }
      }

      const toolName = call.function.name
      log.debug(`执行工具: ${toolName}`)
      if (onChunk) {
        onChunk({
          kind: 'tool_start',
          id: call.id,
          name: toolName,
          arguments: call.function.arguments
        })
      }

      const startedAt = Date.now()
      const toolResult = await executeToolCall(toolName, call.function.arguments)
      const duration = Date.now() - startedAt
      const reflection = reflectOnToolResult(toolName, toolResult)

      state.toolCalls += 1
      if (!state.toolNames.includes(toolName)) state.toolNames.push(toolName)
      if (toolResult?.success === false) {
        state.toolFailed += 1
      } else {
        state.toolSuccess += 1
      }
      if (reflection?.status === 'warning') state.emptyResults += 1
      if (reflection) {
        state.reflections.push({ name: toolName, status: reflection.status, text: reflection.text })
      }

      const toolContent = reflection
        ? `${JSON.stringify(toolResult)}\n\n[系统反思] ${reflection.text}。${reflection.suggestion}`
        : JSON.stringify(toolResult)

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolContent
      })

      if (onChunk) {
        onChunk({
          kind: 'tool_end',
          id: call.id,
          name: toolName,
          success: Boolean(toolResult.success),
          duration,
          result: summarizeToolResult(toolResult)
        })
        if (reflection) {
          onChunk({
            kind: 'reflection',
            id: call.id,
            name: toolName,
            status: reflection.status,
            text: reflection.text
          })
        }
      }
    }

    return await chatStreamInternal(provider, messages, tools, { model, ...options }, onChunk, state, iteration + 1)
  }

  return result
}

const SUMMARY_ROLE_LABELS = {
  system: '系统',
  user: '用户',
  assistant: '助手',
  tool: '工具结果'
}

function flattenMessageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      if (part.type === 'text') return part.text || ''
      if (part.type === 'image_url') return '[图片]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function formatMessageForSummary(message) {
  if (!message || typeof message !== 'object') return ''
  const label = SUMMARY_ROLE_LABELS[message.role] || message.role || '消息'
  const parts = []
  const text = flattenMessageText(message.content).trim()
  if (text) parts.push(text.slice(0, 2000))
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const names = message.tool_calls.map((call) => call?.function?.name || '').filter(Boolean)
    if (names.length > 0) parts.push(`调用工具：${names.join(', ')}`)
  }
  if (parts.length === 0) return ''
  return `${label}：${parts.join(' ')}`
}

export async function compressChatContext(messages, options = {}) {
  const { providerType, providerConfig } = getProviderConfig(options.provider)
  const provider = getProvider(providerType, providerConfig)

  if (!provider) {
    return { success: false, error: `未知的 AI Provider: ${providerType}` }
  }

  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}，请在设置中配置` }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '没有可压缩的对话历史' }
  }

  const rawKeep = Number(options.keepRecent)
  const keepRecent = Math.min(
    20,
    Math.max(2, Number.isFinite(rawKeep) ? Math.round(rawKeep) : COMPRESSION_DEFAULT_KEEP)
  )

  if (messages.length <= keepRecent + 1) {
    return { success: false, error: '历史消息较少，无需压缩' }
  }

  const compressible = messages.slice(0, -keepRecent)
  const kept = messages.slice(-keepRecent)
  const priorSummary = typeof options.contextSummary === 'string' ? options.contextSummary.trim() : ''

  const transcript = compressible
    .map(formatMessageForSummary)
    .filter(Boolean)
    .join('\n')
    .slice(0, COMPRESSION_MAX_INPUT_CHARS)

  if (!transcript && !priorSummary) {
    return { success: false, error: '没有可压缩的对话内容' }
  }

  const userContent = [
    priorSummary ? `已有摘要：\n${priorSummary}` : '',
    `待压缩的历史对话：\n${transcript || '（无新增历史）'}`
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const result = await provider.chat(
      [
        { role: 'system', content: COMPRESSION_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      [],
      { model: options.model, max_tokens: 1500, temperature: 0.2 }
    )

    if (!result?.success) {
      return { success: false, error: result?.error || '上下文压缩失败' }
    }

    const summary = String(result.content || '')
      .trim()
      .slice(0, COMPRESSION_MAX_SUMMARY_CHARS)
    if (!summary) {
      return { success: false, error: '上下文压缩返回为空' }
    }

    return {
      success: true,
      summary,
      compressedCount: compressible.length,
      keptCount: kept.length,
      beforeTokens: estimateTextTokens(priorSummary) + estimateMessagesTokens(compressible),
      afterTokens: estimateTextTokens(summary) + estimateMessagesTokens(kept),
      usage: normalizeUsage(result.usage),
      error: null
    }
  } catch (error) {
    log.warn('上下文压缩异常:', error.message)
    return { success: false, error: error.message }
  }
}

export async function validateApiKey(providerType, apiKey, extraConfig = {}) {
  log.debug(`[validateApiKey] provider=${providerType}`)

  const provider = createProvider(providerType, {
    apiKey,
    ...extraConfig
  })

  if (!provider) {
    log.warn(`未知的 Provider: ${providerType}`)
    return false
  }

  const result = await provider.validateApiKey()
  log.debug(`[validateApiKey] result=${result}`)
  return result
}

export async function getProviderModels(providerType, options = {}) {
  const config = getConfig()
  const apiKeys = config.ai_api_keys || {}
  const localModels = resolveProviderModels(providerType, config.ai_models)
  const defaultModel = resolveProviderDefaultModel(providerType, config.ai_models)

  if (options.defaults) {
    const models = getDefaultProviderModels(providerType)
    return { success: true, models, defaultModel: models[0]?.id || '', source: 'builtin', error: null }
  }

  if (!options.refresh) {
    return { success: true, models: localModels, defaultModel, source: 'config', error: null }
  }

  const endpointId = providerType === 'volcengine' ? apiKeys.volcengine_endpoint_id || '' : ''
  const result = await fetchProviderModels(providerType, {
    apiKey: options.apiKey || apiKeys[providerType] || '',
    groupId: apiKeys.minimax_group_id || '',
    endpointId,
    timeout: config.ai_timeout ? config.ai_timeout * 1000 : 60000,
    connectionTimeout: config.ai_connection_timeout ? config.ai_connection_timeout * 1000 : 10000
  })

  if (!result.success) {
    return { success: false, models: localModels, defaultModel, source: 'config', error: result.error }
  }

  const nextDefault = result.models.some((model) => model.id === defaultModel)
    ? defaultModel
    : result.models[0]?.id || ''

  return { success: true, models: result.models, defaultModel: nextDefault, source: 'remote', error: null }
}

export function getAiProviderCatalog() {
  return getAvailableProviders(getConfig())
}

export { PROVIDER_TYPES, PROVIDER_INFO }
