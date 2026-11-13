import { ref, computed } from 'vue'

export function createState() {
  const messageDialog = ref({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    resolve: null
  })

  const promptDialog = ref({
    visible: false,
    title: '',
    value: '',
    defaultValue: '',
    resolve: null
  })

  const promptInputRef = ref(null)

  const connections = ref([])

  const groups = ref([])

  const expandedGroups = ref([])

  const expandedConnections = ref([])

  const expandedDatabases = ref([])

  const openedDatabases = ref([])

  const expandedObjectCategories = ref([])

  const databaseObjectsMap = ref({})

  const connectionDatabases = ref({})

  const selectedConnection = ref(null)

  const showCreateDialog = ref(false)

  const showEditDialog = ref(false)

  const showGroupDialog = ref(false)

  const showManageDialog = ref(false)

  const createDialogTab = ref('basic')

  const editDialogTab = ref('basic')

  const connecting = ref(false)

  const testingNewConn = ref(false)

  const testingEditConn = ref(false)

  const databases = ref([])

  const tables = ref([])

  const selectedDatabase = ref('')

  const autoLimit = ref(true)

  const limitCount = ref(1000)

  const layoutMode = ref(localStorage.getItem('databaseLayoutMode') || 'two')

  const sidebarWidth = ref(parseInt(localStorage.getItem('databaseSidebarWidth') || '240'))

  const infoPanelWidth = ref(parseInt(localStorage.getItem('databaseInfoPanelWidth') || '280'))

  const isResizingSidebar = ref(false)

  const isResizingInfoPanel = ref(false)

  const limitSettingsDialog = ref({
    show: false,
    tabId: null
  })

  const importDialog = ref({
    show: false,
    tab: null,
    format: 'csv',
    filePath: '',
    headers: [],
    rows: [],
    error: '',
    importing: false
  })

  const exportDialog = ref({
    show: false,
    tab: null,
    format: 'csv',
    scope: 'all',
    includeStructure: false,
    exporting: false
  })

  const objectSearchDialog = ref({
    show: false,
    keyword: '',
    items: [],
    loading: false
  })

  const historyDialog = ref({
    show: false,
    section: 'history',
    keyword: ''
  })

  const userDialog = ref({
    show: false,
    loading: false,
    keyword: '',
    connectionName: '',
    currentUser: '',
    sessionUser: '',
    users: [],
    source: '',
    error: ''
  })

  const aiDialog = ref({
    show: false,
    tab: null,
    prompt: '',
    loading: false,
    result: '',
    error: ''
  })

  const structureDialog = ref({
    show: false,
    tab: null,
    meta: null,
    loading: false
  })

  const erDialog = ref({
    show: false,
    tab: null,
    data: null,
    loading: false
  })

  const explainDialog = ref({
    show: false,
    tab: null,
    result: null,
    loading: false
  })

  const sqlPreviewDialog = ref({
    show: false,
    title: '待执行的 SQL',
    sql: ''
  })

  const connectionTransferDialog = ref({
    show: false,
    mode: 'export',
    includePasswords: false,
    content: '',
    fileName: '',
    importing: false
  })

  const queryHistory = ref([])

  const querySnippets = ref([])

  const tableMeta = ref(null)

  const tableMetaLoading = ref(false)

  const transactionConnections = ref([])

  const tableToolbarState = ref({
    filterSortActive: false
  })

  const tabs = ref([{ id: 'object', name: '对象', type: 'object', closable: false }])

  const activeTabId = ref('object')

  const lastExecutedSql = ref('')

  const lastExecutedTime = ref(0)

  const selectedObject = ref(null)

  const objectSearchKeyword = ref('')

  const objectTableDetails = ref([])

  const tableStructure = ref([])

  const viewDefinition = ref('')

  const functionDefinition = ref('')

  const objectDefinition = ref('')

  const tableDDL = ref('')

  const selectedInfoType = ref(null)

  const selectedCategory = ref(null)

  const selectedGroup = ref(null)

  const connectionInfo = ref(null)

  const databaseInfo = ref(null)

  const tableInfo = ref(null)

  const tableInfoMode = ref('info')

  const objectTypeLabel = computed(() => {
    if (!selectedObject.value) return ''
    const typeLabels = {
      database: '数据库',
      table: '表',
      view: '视图',
      function: '函数',
      procedure: '存储过程',
      trigger: '触发器',
      event: '事件'
    }
    return typeLabels[selectedObject.value.type] || ''
  })

  const filteredTableDetails = computed(() => {
    if (!objectSearchKeyword.value) return objectTableDetails.value
    const keyword = objectSearchKeyword.value.toLowerCase()
    return objectTableDetails.value.filter(
      (table) =>
        table.name.toLowerCase().includes(keyword) || (table.comment && table.comment.toLowerCase().includes(keyword))
    )
  })

  const filteredTableStructure = computed(() => {
    if (!objectSearchKeyword.value) return tableStructure.value
    const keyword = objectSearchKeyword.value.toLowerCase()
    return tableStructure.value.filter(
      (field) =>
        String(field.name || '')
          .toLowerCase()
          .includes(keyword) ||
        String(field.columnType || field.dataType || '')
          .toLowerCase()
          .includes(keyword)
    )
  })

  const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    type: '',
    target: null
  })

  const tabContextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    tab: null
  })

  const fieldSortMenu = ref({
    show: false,
    x: 0,
    y: 0,
    tab: null,
    fieldName: null
  })

  const draggingConnection = ref(null)

  const dragOverGroup = ref(null)

  const newConnection = ref({
    name: '',
    group: '',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    savePassword: true,
    charset: '',
    enableKeepAlive: true,
    keepAliveInterval: 240,
    enableConnectTimeout: true,
    connectTimeout: 30,
    enableReadTimeout: false,
    readTimeout: 30,
    enableWriteTimeout: true,
    writeTimeout: 30,
    autoConnect: false
  })

  const editingConnection = ref(null)

  const editingGroup = ref(null)

  const newGroupName = ref('')

  const connectionGroups = computed(() => {
    const groupMap = {}
    groups.value.forEach((g) => {
      groupMap[g] = []
    })
    connections.value.forEach((conn) => {
      if (conn.group && groupMap[conn.group]) {
        groupMap[conn.group].push(conn)
      }
    })
    return groups.value.map((g) => ({
      name: g,
      connections: groupMap[g]
    }))
  })

  const ungroupedConnections = computed(() => {
    return connections.value.filter((conn) => !conn.group || !groups.value.includes(conn.group))
  })

  return {
    messageDialog,
    promptDialog,
    promptInputRef,
    connections,
    groups,
    expandedGroups,
    expandedConnections,
    expandedDatabases,
    openedDatabases,
    expandedObjectCategories,
    databaseObjectsMap,
    connectionDatabases,
    selectedConnection,
    showCreateDialog,
    showEditDialog,
    showGroupDialog,
    showManageDialog,
    createDialogTab,
    editDialogTab,
    connecting,
    testingNewConn,
    testingEditConn,
    databases,
    tables,
    selectedDatabase,
    autoLimit,
    limitCount,
    layoutMode,
    sidebarWidth,
    infoPanelWidth,
    isResizingSidebar,
    isResizingInfoPanel,
    limitSettingsDialog,
    importDialog,
    exportDialog,
    objectSearchDialog,
    historyDialog,
    userDialog,
    aiDialog,
    structureDialog,
    erDialog,
    explainDialog,
    sqlPreviewDialog,
    connectionTransferDialog,
    queryHistory,
    querySnippets,
    tableMeta,
    tableMetaLoading,
    transactionConnections,
    tableToolbarState,
    tabs,
    activeTabId,
    lastExecutedSql,
    lastExecutedTime,
    selectedObject,
    objectSearchKeyword,
    objectTableDetails,
    tableStructure,
    viewDefinition,
    functionDefinition,
    objectDefinition,
    tableDDL,
    selectedInfoType,
    selectedCategory,
    selectedGroup,
    connectionInfo,
    databaseInfo,
    tableInfo,
    tableInfoMode,
    objectTypeLabel,
    filteredTableDetails,
    filteredTableStructure,
    contextMenu,
    tabContextMenu,
    fieldSortMenu,
    draggingConnection,
    dragOverGroup,
    newConnection,
    editingConnection,
    editingGroup,
    newGroupName,
    connectionGroups,
    ungroupedConnections
  }
}
