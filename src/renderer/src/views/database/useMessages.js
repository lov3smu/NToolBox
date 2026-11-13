export function createMessages(state) {
  const { messageDialog, promptDialog, promptInputRef } = state

  function showPrompt(title, defaultValue = '') {
    promptDialog.value = {
      visible: true,
      title,
      value: defaultValue,
      defaultValue,
      resolve: null
    }

    setTimeout(() => {
      if (promptInputRef.value) {
        promptInputRef.value.focus()
        promptInputRef.value.select()
      }
    }, 100)

    return new Promise((resolve) => {
      promptDialog.value.resolve = resolve
    })
  }

  function onPromptConfirm() {
    if (promptDialog.value.resolve) {
      promptDialog.value.resolve(promptDialog.value.value)
    }
    promptDialog.value.visible = false
  }

  function onPromptCancel() {
    if (promptDialog.value.resolve) {
      promptDialog.value.resolve(null)
    }
    promptDialog.value.visible = false
  }

  function showMessage(message, type = 'info', title = '') {
    messageDialog.value = {
      visible: true,
      type,
      title,
      message,
      resolve: null
    }
    return new Promise((resolve) => {
      messageDialog.value.resolve = resolve
    })
  }

  function showConfirm(message, title = '') {
    messageDialog.value = {
      visible: true,
      type: 'confirm',
      title,
      message,
      resolve: null
    }
    return new Promise((resolve) => {
      messageDialog.value.resolve = resolve
    })
  }

  function onMessageConfirm() {
    if (messageDialog.value.resolve) {
      messageDialog.value.resolve(true)
    }
    messageDialog.value.visible = false
  }

  function onMessageCancel() {
    if (messageDialog.value.resolve) {
      messageDialog.value.resolve(false)
    }
    messageDialog.value.visible = false
  }

  return { showPrompt, onPromptConfirm, onPromptCancel, showMessage, showConfirm, onMessageConfirm, onMessageCancel }
}
