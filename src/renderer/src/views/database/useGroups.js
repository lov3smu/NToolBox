import { getConfig, saveConfig } from '@/api'
export function createGroups(state, api) {
  const {
    activeTabId,
    editingGroup,
    expandedDatabases,
    expandedObjectCategories,
    newGroupName,
    openedDatabases,
    selectedDatabase,
    showGroupDialog,
    showManageDialog,
    tables,
    tabs
  } = state

  function openNewGroupDialog() {
    editingGroup.value = null
    newGroupName.value = ''
    showGroupDialog.value = true
  }

  function editGroup(group) {
    editingGroup.value = group
    newGroupName.value = group.name
    showGroupDialog.value = true
  }

  function closeGroupDialog() {
    showGroupDialog.value = false
    editingGroup.value = null
    newGroupName.value = ''
  }

  async function saveGroup() {
    if (!newGroupName.value) {
      await api.showMessage('请输入分组名称', 'warning')
      return
    }

    try {
      const config = await getConfig()
      const dbConnectionGroups = config.dbConnectionGroups || []

      if (editingGroup.value) {
        const index = dbConnectionGroups.indexOf(editingGroup.value.name)
        if (index >= 0) {
          if (newGroupName.value !== editingGroup.value.name && dbConnectionGroups.includes(newGroupName.value)) {
            await api.showMessage('分组名称已存在', 'error')
            return
          }
          dbConnectionGroups[index] = newGroupName.value

          const dbConnections = config.dbConnections || []
          dbConnections.forEach((conn) => {
            if (conn.group === editingGroup.value.name) {
              conn.group = newGroupName.value
            }
          })
        }
      } else {
        if (dbConnectionGroups.includes(newGroupName.value)) {
          await api.showMessage('分组名称已存在', 'error')
          return
        }
        dbConnectionGroups.push(newGroupName.value)
      }

      await saveConfig({ ...config, dbConnectionGroups })

      showGroupDialog.value = false
      editingGroup.value = null
      newGroupName.value = ''
      await api.loadConnections()
    } catch (error) {
      console.error('保存分组失败:', error)
      await api.showMessage('保存分组失败: ' + error.message, 'error')
    }
  }

  async function deleteGroup(groupName) {
    const confirmed = await api.showConfirm(`确定要删除分组 "${groupName}" 吗？分组内的连接将变为未分组状态。`)
    if (!confirmed) return

    try {
      const config = await getConfig()
      const dbConnectionGroups = config.dbConnectionGroups || []
      const index = dbConnectionGroups.indexOf(groupName)

      if (index >= 0) {
        dbConnectionGroups.splice(index, 1)

        const dbConnections = config.dbConnections || []
        dbConnections.forEach((conn) => {
          if (conn.group === groupName) {
            conn.group = ''
          }
        })

        await saveConfig({ ...config, dbConnectionGroups })
        await api.loadConnections()
      }
    } catch (error) {
      console.error('删除分组失败:', error)
      await api.showMessage('删除分组失败: ' + error.message, 'error')
    }
  }

  function openManageDialog() {
    showManageDialog.value = true
  }

  function closeManageDialog() {
    showManageDialog.value = false
  }

  function openNewQuery(conn) {
    if (!conn.active) {
      api.selectConnection(conn)
      api.connectToDatabase()
    } else {
      api.selectConnection(conn)
    }
    api.createQueryTab(conn.name)
  }

  async function moveToGroup(conn, groupName) {
    try {
      const config = await getConfig()
      const dbConnections = config.dbConnections || []
      const index = dbConnections.findIndex((c) => c.name === conn.name)

      if (index >= 0) {
        dbConnections[index].group = groupName
        await saveConfig({ ...config, dbConnections })
        await api.loadConnections()
      }
    } catch (error) {
      console.error('移动连接失败:', error)
      await api.showMessage('移动连接失败: ' + error.message, 'error')
    }
  }

  async function removeFromGroup(conn) {
    try {
      const config = await getConfig()
      const dbConnections = config.dbConnections || []
      const index = dbConnections.findIndex((c) => c.name === conn.name)

      if (index >= 0) {
        dbConnections[index].group = ''
        await saveConfig({ ...config, dbConnections })
        await api.loadConnections()
      }
    } catch (error) {
      console.error('从组中删除失败:', error)
      await api.showMessage('从组中删除失败: ' + error.message, 'error')
    }
  }

  async function openDatabase(target) {
    if (!target.connection || !target.database) return
    await api.openDatabaseFromSidebar(target.connection, target.database)
  }

  function closeDatabase(target) {
    const key = `${target.connection.name}_${target.database}`

    openedDatabases.value = openedDatabases.value.filter((k) => k !== key)

    expandedDatabases.value = expandedDatabases.value.filter((k) => k !== key)

    expandedObjectCategories.value = expandedObjectCategories.value.filter((k) => !k.startsWith(`${key}_`))

    const tabsToClose = tabs.value.filter(
      (t) => t.type === 'query' && t.connectionName === target.connection.name && t.database === target.database
    )

    tabsToClose.forEach((t) => {
      const index = tabs.value.findIndex((tab) => tab.id === t.id)
      if (index >= 0) {
        tabs.value.splice(index, 1)
      }
    })

    if (tabsToClose.length > 0 && tabsToClose.some((t) => t.id === activeTabId.value)) {
      const remainingTabs = tabs.value.filter((t) => t.id !== activeTabId.value)
      if (remainingTabs.length > 0) {
        activeTabId.value = remainingTabs[remainingTabs.length - 1].id
      } else {
        activeTabId.value = 'object'
      }
    }

    if (selectedDatabase.value === target.database) {
      selectedDatabase.value = ''
      tables.value = []
      api.clearObjectInfo()
    }
  }

  return {
    openNewGroupDialog,
    editGroup,
    closeGroupDialog,
    saveGroup,
    deleteGroup,
    openManageDialog,
    closeManageDialog,
    openNewQuery,
    moveToGroup,
    removeFromGroup,
    openDatabase,
    closeDatabase
  }
}
