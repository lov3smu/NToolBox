<template>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('脚本生成') }}</h3>
    </div>
    <div class="setting-section-body">
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('脚本存储路径') }}</span>
          <span class="setting-row-desc">{{ t('生成脚本的默认保存目录，留空使用用户文档目录') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="path-input-group">
            <AppInput v-model="basePath" type="text" :placeholder="t('脚本存储根目录')" />
            <button class="btn btn-secondary" @click="selectDir">{{ t('浏览') }}</button>
          </div>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('开发者姓名') }}</span>
        </div>
        <div class="setting-row-control">
          <div class="name-input-group">
            <AppInput
              v-model="developerChName"
              type="text"
              :placeholder="t('中文署名（脚本作者）')"
              :aria-label="t('开发者姓名（中文）')"
            />
            <AppInput
              v-model="developerEnName"
              type="text"
              :placeholder="t('英文署名（历史记录）')"
              :aria-label="t('开发者姓名（英文）')"
            />
          </div>
        </div>
      </div>
      <div class="setting-row is-top">
        <div class="setting-row-text">
          <span class="setting-row-label">{{ t('默认文本编辑器') }}</span>
          <span class="setting-row-desc">{{ t('在系统文件管理器中打开脚本时使用') }}</span>
        </div>
        <div class="setting-row-control">
          <SettingSelect v-model="textEditApp" :options="textEditorOptions" :placeholder="t('自定义路径')" />
          <div v-if="!editorPresets.some((e) => e.path === textEditApp)" class="path-input-group">
            <AppInput v-model="textEditApp" type="text" :placeholder="t('编辑器可执行文件路径')" />
            <button class="btn btn-secondary" @click="selectEditor">{{ t('浏览') }}</button>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('数据库列表') }}</h3>
      <span class="setting-section-desc">{{ t('生成脚本时可选的数据库，可拖动调整顺序') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-list-block">
        <div ref="databaseListRef" class="config-list" @dragover.prevent @drop.prevent="dropConfigDrag('database')">
          <div
            v-for="(db, index) in databases"
            :key="index"
            class="config-item"
            :class="{
              dragging: isDragging('database', index),
              'drag-over': isDragOver('database', index)
            }"
            :draggable="isDragEnabled('database')"
            @dragstart="startConfigDrag('database', index, $event)"
            @dragover.prevent="overConfigDrag('database', index)"
            @drop.stop.prevent="dropConfigDrag('database')"
            @dragend="endConfigDrag('database')"
          >
            <span
              class="config-drag-handle"
              :title="t('拖动排序')"
              :aria-label="t('拖动排序')"
              @mousedown="enableConfigDrag('database')"
              @click="endConfigDrag('database')"
            >
              <AppIcon name="grip" />
            </span>
            <div class="config-item-info">
              <AppInput v-model="db.name" type="text" :placeholder="t('数据库名')" :class="{ error: db.error }" />
            </div>
            <div class="config-item-actions">
              <button class="btn btn-danger" @click="removeDatabase(index)">{{ t('删除') }}</button>
            </div>
          </div>
        </div>
        <button class="btn btn-secondary" @click="addDatabase">{{ t('+ 添加数据库') }}</button>
      </div>
    </div>
  </section>
  <section class="setting-section">
    <div class="setting-section-head">
      <h3 class="setting-section-title">{{ t('脚本类型') }}</h3>
      <span class="setting-section-desc">{{ t('生成脚本时可选的脚本类型，可拖动调整顺序') }}</span>
    </div>
    <div class="setting-section-body">
      <div class="setting-list-block">
        <div ref="scriptTypeListRef" class="config-list" @dragover.prevent @drop.prevent="dropConfigDrag('scriptType')">
          <div
            v-for="(st, index) in scriptTypes"
            :key="index"
            class="config-item"
            :class="{
              dragging: isDragging('scriptType', index),
              'drag-over': isDragOver('scriptType', index)
            }"
            :draggable="isDragEnabled('scriptType')"
            @dragstart="startConfigDrag('scriptType', index, $event)"
            @dragover.prevent="overConfigDrag('scriptType', index)"
            @drop.stop.prevent="dropConfigDrag('scriptType')"
            @dragend="endConfigDrag('scriptType')"
          >
            <span
              class="config-drag-handle"
              :title="t('拖动排序')"
              :aria-label="t('拖动排序')"
              @mousedown="enableConfigDrag('scriptType')"
              @click="endConfigDrag('scriptType')"
            >
              <AppIcon name="grip" />
            </span>
            <div class="config-item-info">
              <AppInput
                v-model="st.name"
                type="text"
                :placeholder="t('名称')"
                style="width: 120px; margin-right: 10px"
                :class="{ error: st.error }"
              />
              <AppInput v-model="st.description" type="text" :placeholder="t('描述')" style="flex: 1" />
            </div>
            <div class="config-item-actions">
              <button class="btn btn-danger" @click="removeScriptType(index)">{{ t('删除') }}</button>
            </div>
          </div>
        </div>
        <button class="btn btn-secondary" @click="addScriptType">{{ t('+ 添加脚本类型') }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'
import AppIcon from '@/components/AppIcon.vue'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import { SETTINGS_CONTEXT } from '../settingsContext'
import AppInput from '@/components/AppInput.vue'

const {
  addDatabase,
  addScriptType,
  basePath,
  databases,
  developerChName,
  developerEnName,
  dropConfigDrag,
  editorPresets,
  enableConfigDrag,
  endConfigDrag,
  isDragEnabled,
  isDragOver,
  isDragging,
  overConfigDrag,
  removeDatabase,
  removeScriptType,
  scriptTypes,
  selectDir,
  selectEditor,
  startConfigDrag,
  textEditApp,
  textEditorOptions
} = inject(SETTINGS_CONTEXT)
</script>
