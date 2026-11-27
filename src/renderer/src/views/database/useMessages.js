export function createMessages(state) {
  const { messageDialog } = state

  function showPrompt(title, defaultValue = '') {
    messageDialog.value = {
      visible: true,
      prompt: true,
      type: 'confirm',
      title,
      message: '',
      inputValue: defaultValue,
      resolve: null
    }
    return new Promise((resolve) => {
      messageDialog.value.resolve = resolve
    })
  }

  function showMessage(message, type = 'info', title = '') {
    messageDialog.value = {
      visible: true,
      prompt: false,
      type,
      title,
      message,
      inputValue: '',
      resolve: null
    }
    return new Promise((resolve) => {
      messageDialog.value.resolve = resolve
    })
  }

  function showConfirm(message, title = '') {
    messageDialog.value = {
      visible: true,
      prompt: false,
      type: 'confirm',
      title,
      message,
      inputValue: '',
      resolve: null
    }
    return new Promise((resolve) => {
      messageDialog.value.resolve = resolve
    })
  }

  function onMessageConfirm() {
    if (messageDialog.value.resolve) {
      messageDialog.value.resolve(messageDialog.value.prompt ? messageDialog.value.inputValue : true)
    }
    messageDialog.value.visible = false
  }

  function onMessageCancel() {
    if (messageDialog.value.resolve) {
      messageDialog.value.resolve(messageDialog.value.prompt ? null : false)
    }
    messageDialog.value.visible = false
  }

  return { showPrompt, showMessage, showConfirm, onMessageConfirm, onMessageCancel }
}
