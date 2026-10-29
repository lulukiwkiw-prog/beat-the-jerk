/** 裝置不支援 WebGL 時顯示，不出現空白畫面或錯誤。 */
export function NoWebGL() {
  return (
    <div className="no-webgl" role="alert">
      <p className="no-webgl-title">這台裝置無法顯示 3D 畫面</p>
      <p className="no-webgl-sub">可以換一台裝置或瀏覽器再試試看。</p>
    </div>
  );
}
