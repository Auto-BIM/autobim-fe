// 3D 뷰어 — three.js. 돌리기·확대(OrbitControls), 시점 바꾸기, 높이 단면(위를 잘라 안을 보기).
// 색은 디자인 값(CSS 변수)에서 읽는다 — 화면과 3D가 같은 무채색 계열이 되게.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cx } from "@design";

type View = "iso" | "top" | "front";

function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

export function Viewer3D({ url, heightM, onError }: { url: string; heightM: number; onError?: (msg: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setView: (v: View) => void; setCut: (h: number) => void } | null>(null);
  const [view, setView] = useState<View>("iso");
  const [cut, setCut] = useState(heightM);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = cssColor("--color-surface-2", "#ebe6dc");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // 바닥 아래로는 돌아가지 않게

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(6, 12, 8);
    scene.add(sun);

    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), heightM);
    let size = new THREE.Vector3(10, 3, 10);
    let center = new THREE.Vector3();

    const fit = (v: View) => {
      const r = Math.max(size.x, size.z) * 0.5;
      const dist = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
      controls.target.copy(center);
      if (v === "top") camera.position.set(center.x, center.y + dist * 1.1, center.z + 0.001);
      else if (v === "front") camera.position.set(center.x, center.y + size.y * 0.6, center.z + dist);
      else camera.position.set(center.x + dist * 0.7, center.y + dist * 0.75, center.z + dist * 0.7);
      camera.near = dist / 200;
      camera.far = dist * 20;
      camera.updateProjectionMatrix();
      controls.update();
    };

    new GLTFLoader().load(
      url,
      (gltf) => {
        const edgeColor = cssColor("--color-ink-3", "#6b655b");
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.clippingPlanes = [clip];
          mat.side = THREE.DoubleSide;
          // 모서리 선 — 도면처럼 또렷하게
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(m.geometry, 30),
            new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.55, clippingPlanes: [clip] }),
          );
          m.add(edges);
        });
        scene.add(gltf.scene);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        size = box.getSize(new THREE.Vector3());
        center = box.getCenter(new THREE.Vector3());
        const grid = new THREE.GridHelper(Math.ceil(Math.max(size.x, size.z) + 4), Math.ceil(Math.max(size.x, size.z) + 4),
          cssColor("--color-line-strong", "#8f887c"), cssColor("--color-line", "#ddd6c9"));
        grid.position.y = box.min.y - 0.001;
        (grid.material as THREE.Material).transparent = true;
        (grid.material as THREE.Material).opacity = 0.5;
        scene.add(grid);
        fit("iso");
        setReady(true);
      },
      undefined,
      () => onError?.("3D 모델을 불러오지 못했어요. 새로고침하거나 다시 만들어 주세요."),
    );

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    api.current = { setView: fit, setCut: (h: number) => {
      clip.constant = h;
    } };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      el.removeChild(renderer.domElement);
    };
  }, [url, heightM, onError]);

  useEffect(() => {
    api.current?.setCut(cut + 0.0001); // 중괄호 필수: 값을 돌려주면 React가 정리 함수로 착각한다
  }, [cut]);

  const views: [View, string][] = [["iso", "비스듬히"], ["top", "위에서"], ["front", "정면"]];
  return (
    <div className="border border-line">
      <div ref={host} className="relative aspect-4/3 w-full [&>canvas]:block [&>canvas]:size-full" aria-label="3D 모델 보기 — 끌어서 돌리고, 휠로 확대해요" role="img">
        {!ready ? <span className="absolute inset-0 grid place-items-center text-body-sm text-ink-3">3D 모델을 불러오는 중…</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line bg-surface px-4 py-3">
        <div role="radiogroup" aria-label="시점" className="flex">
          {views.map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => {
                setView(v);
                api.current?.setView(v);
              }}
              className={cx(
                "-ml-px h-9 border border-line px-3 text-body-sm text-ink-2 first:ml-0 hover:text-ink",
                "aria-checked:z-10 aria-checked:border-ink aria-checked:bg-ink aria-checked:font-medium aria-checked:text-bg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex min-w-56 flex-1 items-center gap-3 text-body-sm text-ink-2">
          <span className="shrink-0">단면 높이</span>
          <input
            type="range"
            min={0.1}
            max={heightM}
            step={0.05}
            value={cut}
            onChange={(e) => setCut(Number(e.target.value))}
            className="min-w-0 flex-1 accent-[var(--color-ink)]"
            aria-valuetext={`${cut.toFixed(2)} m`}
          />
          <span className="w-14 shrink-0 text-right tabular-nums text-ink">{cut.toFixed(2)} m</span>
        </label>
        <span className="text-label text-ink-3">끌어서 돌리기 · 휠·두 손가락으로 확대 · 오른쪽 끌기로 이동</span>
      </div>
    </div>
  );
}
