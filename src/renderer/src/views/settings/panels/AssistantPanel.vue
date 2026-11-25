<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('场景预设') }}</h3>
      <span class="setting-section-desc">{{ t('一键套用一组参数，应用后仍可逐项微调，更改会自动保存') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('模式') }}</span>
          <span class="setting-row-desc">
            {{ t('预设会覆盖温度、压缩、Agent 运行与工具预算；严格审批模式同时切回“写操作前询问”') }}
          </span>
        </div>
        <div class="setting-row-control preset-actions">
          <button
            v-for="preset in aiPresets"
            :key="preset.id"
            type="button"
            class="btn"
            :class="appliedPresetId === preset.id ? 'btn-primary' : 'btn-secondary'"
            :title="t(preset.description)"
            @click="applyAiPreset(preset)"
          >
            {{ t(preset.name) }}
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('人设与风格') }}</h3>
      <span class="setting-section-desc">
        {{ t('追加到系统提示词，让助手以指定身份与风格回答；不会改变工具执行与安全规则') }}
      </span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row is-block">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('自定义人设') }}</span>
          <span class="setting-row-desc">
            {{ t('例如：你是一位资深后端工程师，回答先给结论，再给关键步骤与风险提示') }}
          </span>
        </div>
        <div class="setting-row-control">
          <AppTextarea
            v-model="aiPersona"
            class="persona-input"
            rows="6"
            maxlength="4000"
            spellcheck="false"
            :placeholder="t('描述希望助手扮演的角色、语气与回答偏好，留空使用默认设定')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('生成参数') }}</h3>
      <span class="setting-section-desc">{{
        t('仅影响对话请求；任务规划、上下文压缩等辅助请求使用各自的固定参数')
      }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('温度') }}</span>
          <span class="setting-row-desc">
            {{ t('0 最稳定，0.7 较平衡，1 以上更发散；留空使用供应商默认值，部分推理模型固定温度') }}
          </span>
        </div>
        <div class="setting-row-control">
          <AppInput
            v-model="aiTemperature"
            type="number"
            class="temperature-input"
            min="0"
            max="2"
            step="0.1"
            :placeholder="t('默认')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('分场景模型') }}</h3>
      <span class="setting-section-desc">
        {{ t('规划与压缩等辅助任务可指定更便宜的模型；留空跟随当前对话模型，格式为 provider:model') }}
      </span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('任务规划') }}</span>
          <span class="setting-row-desc">{{ t('生成执行计划时使用；计划仅为内部参考') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingModelPicker
            v-model="scenarioPlanner"
            :options="scenarioModelOptions"
            :placeholder="t('如 bailian:qwen3.8-flash')"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('上下文压缩') }}</span>
          <span class="setting-row-desc">{{ t('对话历史达到窗口阈值时压缩摘要使用') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingModelPicker
            v-model="scenarioCompression"
            :options="scenarioModelOptions"
            :placeholder="t('如 bailian:qwen3.8-flash')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('上下文压缩') }}</h3>
      <span class="setting-section-desc">{{
        t('对话历史占用达到阈值时，较早的消息会被摘要压缩，避免超出模型上下文窗口')
      }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('触发阈值') }}</span>
          <span class="setting-row-desc">{{ t('历史占用达到上下文窗口的该比例时开始压缩') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="aiCompressThreshold"
            :options="aiCompressThresholdOptions"
            :placeholder="t('选择阈值')"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('压缩后保留消息数') }}</span>
          <span class="setting-row-desc">{{ t('最近若干条消息保留原文，更早的内容才会被摘要') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="aiCompressKeepRecent"
            :options="aiCompressKeepRecentOptions"
            :placeholder="t('选择条数')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('附件限制') }}</h3>
      <span class="setting-section-desc">{{ t('限制单条消息可携带的附件数量与单个文件大小') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('附件数量') }}</span>
          <span class="setting-row-desc">{{ t('单条消息最多可添加的附件个数') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="aiMaxAttachments" :options="aiMaxAttachmentOptions" :placeholder="t('选择数量')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('图片大小上限') }}</span>
          <span class="setting-row-desc">{{ t('单张图片超过该大小时拒绝添加') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="aiMaxImageMb" :options="aiMaxImageMbOptions" :placeholder="t('选择大小')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('文本文件上限') }}</span>
          <span class="setting-row-desc">{{ t('单个文本附件超过该大小时拒绝添加') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="aiMaxTextKb" :options="aiMaxTextKbOptions" :placeholder="t('选择大小')" />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('Agent 运行') }}</h3>
      <span class="setting-section-desc">{{ t('控制单次任务的循环深度与时长上限，修改后对新对话生效') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('最大执行轮次') }}</span>
          <span class="setting-row-desc">{{ t('模型与工具循环的上限，达到后停止自动执行并给出提示') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="agentMaxIterations"
            :options="agentMaxIterationsOptions"
            :placeholder="t('选择轮次')"
          />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('单任务超时') }}</span>
          <span class="setting-row-desc">{{ t('单次任务从开始到结束的时长上限，超时后停止并提示') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="agentTimeoutMin" :options="agentTimeoutMinOptions" :placeholder="t('选择时长')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('计划步骤上限') }}</span>
          <span class="setting-row-desc">{{ t('规划器最多拆分的步骤数，复杂任务可适当调高') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="agentPlanSteps" :options="agentPlanStepsOptions" :placeholder="t('选择步骤数')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('并行工具数') }}</span>
          <span class="setting-row-desc">{{ t('同一轮内多个工具调用的并发上限，调低更稳、调高更快') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="agentParallelTools"
            :options="agentParallelToolsOptions"
            :placeholder="t('选择并发数')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('工具结果预算') }}</h3>
      <span class="setting-section-desc">{{ t('超大工具输出会被截断并落盘，可用 result-read 分页读取') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('单结果上限') }}</span>
          <span class="setting-row-desc">{{ t('单个工具输出超过该大小时截断，完整内容落盘保留') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="toolResultMaxKb" :options="toolResultMaxKbOptions" :placeholder="t('选择大小')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('单次运行上限') }}</span>
          <span class="setting-row-desc">{{ t('一次任务累计工具输出的上限，超出后后续结果也会被截断') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="toolResultRunKb" :options="toolResultRunKbOptions" :placeholder="t('选择大小')" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('溢出结果保留') }}</span>
          <span class="setting-row-desc">{{ t('落盘的完整工具结果保留天数，过期自动清理') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect
            v-model="toolResultRetentionDays"
            :options="toolResultRetentionOptions"
            :placeholder="t('选择天数')"
          />
        </div>
      </div>
    </div>
  </section>

  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('工具审批') }}</h3>
      <span class="setting-section-desc">{{ t('AI 调用写操作工具前的确认策略；对话页可临时切换本次会话的策略') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('审批策略') }}</span>
          <span class="setting-row-desc">{{ t(toolPolicyHint) }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="toolPolicy" :options="toolPolicyOptions" :placeholder="t('选择审批策略')" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import SettingModelPicker from '@/components/settings/SettingModelPicker.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'

const {
  agentMaxIterations,
  agentMaxIterationsOptions,
  agentParallelTools,
  agentParallelToolsOptions,
  agentPlanSteps,
  agentPlanStepsOptions,
  agentTimeoutMin,
  agentTimeoutMinOptions,
  aiCompressKeepRecent,
  aiCompressKeepRecentOptions,
  aiCompressThreshold,
  aiCompressThresholdOptions,
  aiMaxAttachmentOptions,
  aiMaxAttachments,
  aiMaxImageMb,
  aiMaxImageMbOptions,
  aiMaxTextKb,
  aiMaxTextKbOptions,
  aiPersona,
  aiPresets,
  aiTemperature,
  appliedPresetId,
  applyAiPreset,
  scenarioCompression,
  scenarioModelOptions,
  scenarioPlanner,
  toolPolicy,
  toolPolicyHint,
  toolPolicyOptions,
  toolResultMaxKb,
  toolResultMaxKbOptions,
  toolResultRetentionDays,
  toolResultRetentionOptions,
  toolResultRunKb,
  toolResultRunKbOptions
} = inject(SETTINGS_CONTEXT)
</script>
