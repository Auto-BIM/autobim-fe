// 3D 뷰어 — 서버가 만든 .glb를 보여주고, 벽·문·창을 눌러 고를 수 있게 한다.
//
// glb 규약(autobim-be docs/api.md "출력 파일"): 벽마다 노드 하나, 노드 이름 = 벽 ID(w1…), m 단위, Y가 위.
//   → 눌린 메시의 이름으로 어떤 벽인지 안다.
// 문·창은 glb 안에서 벽에 뚫린 구멍일 뿐이라, Plan 값으로 얇은 상자 테두리를 그려 보여주고 누를 수 있게 한다.
//   Plan (x, y) mm → 3D (x/1000, 높이, −y/1000)
// 색은 디자인 값(CSS 변수)에서 읽는다 — 2D 평면과 같은 색 약속.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cx } from "@design";
import type { Plan } from "./api";
import { openingCenter, wallDir } from "./plan";

type View = "iso" | "top" | "front";
type Props = {
  url: string;
  plan: Plan; // glb와 같은 리비전의 Plan (문·창 위치에 씀)
  selected: string | null;
  review: Set<string>;
  onSelect: (id: string | null) => void;
  onError?: (msg: string) => void;
  overlay?: string | null; // "다시 만드는 중…" 같은 안내
};

const css = (name: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "gray");

type Api = { setView: (v: View) => void; setCut: (h: number) => void; paint: (sel: string | null, review: Set<string>) => void };

// 리비전이 바뀌어 모델을 다시 불러와도 보던 시점을 유지한다
let lastCamera: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

export function Viewer3D({ url, plan, selected, review, onSelect, onError, overlay }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [view, setView] = useState<View>("iso");
  const maxH = Math.max(...plan.walls.map((w) => w.height), 2400) / 1000;
  const [cut, setCut] = useState(maxH);
  const [ready, setReady] = useState(false);
  // 3D 안의 이벤트는 한 번만 연결하므로, 늘 최신 값을 보도록 ref에 담는다
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const reviewRef = useRef(review);
  selectRef.current = onSelect;
  selectedRef.current = selected;
  reviewRef.current = review;

  useEffect(() => {
    const el = host.current!;
    setReady(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onError?.("이 브라우저에서는 3D를 그릴 수 없어요. 평면 보기를 써 주세요.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = css("--color-surface-2");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(-6, 12, 8);
    scene.add(sun);

    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), maxH + 0.01);
    const colors = {
      wall: css("--color-model-wall"),
      edge: css("--color-ink-3"),
      sel: css("--color-accent"),
      review: css("--color-review"),
      door: css("--color-door"),
      window: css("--color-window"),
    };

    // id → 그 요소를 그리는 재질들 (고르면 색만 바꾼다 — 다시 만들지 않음)
    const wallMats = new Map<string, THREE.MeshStandardMaterial>();
    const openingMats = new Map<string, { line: THREE.LineBasicMaterial; fill: THREE.MeshBasicMaterial; base: THREE.Color }>();
    const pickables: THREE.Object3D[] = [];
    let size = new THREE.Vector3(10, 3, 10);
    let center = new THREE.Vector3();

    const fit = (v: View) => {
      const r = Math.max(size.x, size.z) * 0.5;
      const dist = (r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.3;
      controls.target.copy(center);
      if (v === "top") camera.position.set(center.x, center.y + dist * 1.1, center.z + 0.001);
      else if (v === "front") camera.position.set(center.x, center.y + size.y * 0.6, center.z + dist);
      else camera.position.set(center.x + dist * 0.65, center.y + dist * 0.8, center.z + dist * 0.75);
      camera.near = dist / 200;
      camera.far = dist * 20;
      camera.updateProjectionMatrix();
      controls.update();
    };

    // 문·창: Plan 값으로 상자를 만들어 벽 구멍 자리에 놓는다
    const walls = new Map(plan.walls.map((w) => [w.id, w]));
    for (const o of plan.openings) {
      const w = walls.get(o.wall_id);
      if (!w) continue;
      const c = openingCenter(o, w);
      const d = wallDir(w);
      const geo = new THREE.BoxGeometry(o.width / 1000, o.height / 1000, (w.thickness * 1.15) / 1000);
      const base = o.type === "door" ? colors.door : colors.window;
      const line = new THREE.LineBasicMaterial({ color: base, clippingPlanes: [clip] });
      const fill = new THREE.MeshBasicMaterial({ color: base, transparent: true, opacity: 0.18, clippingPlanes: [clip], depthWrite: false });
      const box = new THREE.Mesh(geo, fill);
      box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), line));
      box.position.set(c.x / 1000, (o.sill_height + o.height / 2) / 1000, -c.y / 1000);
      box.rotation.y = Math.atan2(d.y, d.x);
      box.name = o.id;
      scene.add(box);
      pickables.push(box);
      openingMats.set(o.id, { line, fill, base });
    }

    new GLTFLoader().load(
      url,
      (gltf) => {
        gltf.scene.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (!m.isMesh) return;
          // glb에 재질이 없어도 우리 색으로 — 벽마다 재질을 따로 둬야 하나만 색을 바꿀 수 있다
          const id = m.name || m.parent?.name || "";
          // glb에 법선(빛 계산용 면 방향)이 없으면 벽이 까맣게 보인다 → 직접 계산
          if (!m.geometry.getAttribute("normal")) m.geometry.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({ color: colors.wall.clone(), roughness: 0.9, side: THREE.DoubleSide, clippingPlanes: [clip] });
          m.material = mat;
          m.name = id;
          m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: colors.edge, transparent: true, opacity: 0.5, clippingPlanes: [clip] })));
          wallMats.set(id, mat);
          pickables.push(m);
        });
        scene.add(gltf.scene);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        size = box.getSize(new THREE.Vector3());
        center = box.getCenter(new THREE.Vector3());
        const n = Math.ceil(Math.max(size.x, size.z) + 4);
        const grid = new THREE.GridHelper(n, n, css("--color-line-strong"), css("--color-line"));
        grid.position.set(center.x, box.min.y - 0.001, center.z);
        scene.add(grid);
        if (lastCamera) {
          camera.position.copy(lastCamera.pos);
          controls.target.copy(lastCamera.target);
          camera.near = 0.05;
          camera.far = 500;
          camera.updateProjectionMatrix();
        } else fit("iso");
        api.current?.paint(selectedRef.current, reviewRef.current);
        setReady(true);
      },
      undefined,
      () => onError?.("3D 모델을 불러오지 못했어요. 새로 고치거나 잠시 뒤 다시 열어 주세요."),
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

    // 누르기(끌지 않고 떼기) → 맞은 요소 고르기, 빈 곳이면 고르기 해제
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const cv = renderer.domElement;
    const pick = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // 문·창 상자가 벽 안에 있으므로 상자를 먼저 본다
      const hits = ray.intersectObjects(pickables, false);
      const opening = hits.find((h) => openingMats.has(h.object.name));
      return (opening ?? hits[0])?.object.name ?? null;
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) selectRef.current(pick(e));
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!e.buttons) cv.style.cursor = pick(e) ? "pointer" : "grab";
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointermove", onMove);

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    api.current = {
      setView: fit,
      setCut: (h) => {
        clip.constant = h;
      },
      paint: (sel, rev) => {
        for (const [id, mat] of wallMats) {
          mat.color.copy(id === sel ? colors.sel : rev.has(id) ? colors.wall.clone().lerp(colors.review, 0.35) : colors.wall);
          mat.emissive.copy(id === sel ? colors.sel : new THREE.Color(0)).multiplyScalar(id === sel ? 0.25 : 0);
        }
        for (const [id, m] of openingMats) {
          const c = id === sel ? colors.sel : rev.has(id) ? colors.review : m.base;
          m.line.color.copy(c);
          m.fill.color.copy(c);
          m.fill.opacity = id === sel ? 0.45 : 0.18;
        }
      },
    };

    return () => {
      lastCamera = { pos: camera.position.clone(), target: controls.target.clone() };
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointermove", onMove);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      el.removeChild(cv);
      api.current = null;
    };
    // plan은 url(리비전)과 함께 바뀌므로 url만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 고른 것·확인 필요가 바뀌면 색만 다시 칠한다
  useEffect(() => {
    api.current?.paint(selected, review);
  }, [selected, review]);

  useEffect(() => {
    api.current?.setCut(cut + 0.0001); // 중괄호 필수: 값을 돌려주면 React가 정리 함수로 착각한다
  }, [cut]);

  const views: [View, string][] = [["iso", "비스듬히"], ["top", "위에서"], ["front", "정면"]];
  return (
    <div className="flex h-full flex-col">
      <div ref={host} className="relative min-h-0 flex-1 [&>canvas]:block [&>canvas]:size-full" role="img" aria-label="3D 모델 — 끌어서 돌리고, 휠로 확대하고, 벽·문·창을 눌러 골라요">
        {!ready ? <span className="absolute inset-0 grid place-items-center text-body-sm text-ink-3">3D 모델을 불러오는 중…</span> : null}
        {overlay ? (
          <span className="absolute top-3 left-3 border border-line bg-surface px-3 py-1.5 text-label text-ink-2" role="status">{overlay}</span>
        ) : null}
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
            max={maxH}
            step={0.05}
            value={cut}
            onChange={(e) => setCut(Number(e.target.value))}
            className="min-w-0 flex-1 accent-(--color-ink)"
            aria-valuetext={`${cut.toFixed(2)} m`}
          />
          <span className="w-14 shrink-0 text-right tabular-nums text-ink">{cut.toFixed(2)} m</span>
        </label>
      </div>
    </div>
  );
}
