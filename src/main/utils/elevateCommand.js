export function buildElevatedMkdirCommand(targetPath, platform = process.platform) {
  if (platform === 'win32') {
    const quoted = `"${targetPath.replace(/"/g, '""')}"`
    return `cmd /c if not exist ${quoted} mkdir ${quoted}`
  }
  const quoted = `'${targetPath.replace(/'/g, `'\\''`)}'`
  return `mkdir -p ${quoted}`
}
