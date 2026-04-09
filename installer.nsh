!macro customHeader
  !ifndef MUI_WELCOMEFINISHPAGE_BITMAP
    !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installerSidebar.bmp"
    !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\installerSidebar.bmp"
  !endif
!macroend

!macro preInit
  SetRegView 64
!macroend

!macro customInit
!macroend

!macro customInstall
!macroend

!macro customUnInstall
!macroend