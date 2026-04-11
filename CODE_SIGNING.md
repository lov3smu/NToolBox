# Windows 代码签名说明

## 问题

在 Windows 平台上，使用 `electron-updater` 进行自动更新时，会出现以下错误：

```
is not signed by the application owner
```

这是因为 Windows 要求应用程序和更新包必须使用代码签名证书进行签名。

## 解决方案

### 方案 1：购买商业代码签名证书（推荐用于生产环境）

可以从以下 CA 购买代码签名证书：

- [DigiCert](https://www.digicert.com/)
- [Sectigo](https://sectigo.com/)
- [GlobalSign](https://www.globalsign.com/)

购买后，在 `package.json` 中添加签名配置：

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "your-password"
    }
  }
}
```

或使用环境变量：

```bash
set WIN_CSC_LINK=path/to/certificate.p12
set WIN_CSC_KEY_PASSWORD=your-password
npm run build:win
```

### 方案 2：使用 Azure Code Signing

对于开源项目，可以使用 [Azure Code Signing](https://azure.microsoft.com/services/code-signing/) 服务。

### 方案 3：禁用自动更新（仅用于测试）

在 `src/main/updater.js` 中已添加了签名错误处理，当检测到签名错误时会提示用户手动下载。

### 方案 4：手动更新

用户可以在 GitHub Releases 页面手动下载最新版本：
https://github.com/lov3smu/sql-script-generator/releases

## macOS 代码签名

macOS 同样需要代码签名，但可以使用免费的 Apple Developer 账户进行签名。

在 `package.json` 中配置：

```json
{
  "build": {
    "mac": {
      "identity": "Your Name (Team ID)"
    }
  }
}
```

## 当前项目状态

当前项目使用自动更新功能，但在 Windows 上没有代码签名证书。因此：

1. **自动更新检测** - 正常工作，可以检测到新版本
2. **自动下载安装** - 在 Windows 上会失败，提示用户手动下载
3. **手动下载** - 始终可用，用户可以前往 GitHub Releases 页面下载

## 建议

对于个人开源项目，建议：

1. 保持当前行为（检测更新 + 提示手动下载）
2. 在 README 中说明 Windows 用户需要手动更新
3. 如果项目规模扩大，考虑购买代码签名证书

## 参考

- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [Windows Code Signing Guide](https://docs.microsoft.com/windows-hardware/drivers/dashboard/code-signing-cert-manage)
