/**
 * 클립보드 복사.
 *
 * navigator.clipboard 는 보안 컨텍스트(https 또는 localhost)에서만 동작한다.
 * 이 앱은 매장 안에서 http://192.168.x.x 주소로 여는 경우가 많은데 그때는
 * 보안 컨텍스트가 아니라서 최신 API 를 쓸 수 없으므로, 구식 방식으로 넘어간다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 대체 방식으로 넘어간다
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
