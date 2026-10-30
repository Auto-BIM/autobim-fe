import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/noto-serif-kr/400.css";
// 영문 대문자 라벨(micro-label) — editorial 디렉션 글꼴 (SIL OFL 1.1, 라틴 글자만)
import "@fontsource-variable/inter-tight/wght.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
