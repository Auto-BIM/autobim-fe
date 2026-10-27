// 첫 화면 3D 도면 — 가운데에 샘플 평면도를 세워 두고, 끌어서 돌리고, 누르면 들여다본다.
//
// 움직임 규칙 (design/DESIGN.md 8장)
// - 혼자 계속 도는 장식은 없다. 돌리기·들여다보기는 모두 사용자가 했을 때만.
// - 처음 한 번만 벽이 바닥 선에서 솟아오른다 — 이 서비스가 하는 일(2D → 3D)을 보여주는 움직임. 1.4초, 다시 안 함.
// - 움직임 줄이기(prefers-reduced-motion)면 솟아오르기·카메라 이동 없이 바로 바뀐다.
// - 전체 보기에서는 휠 확대를 꺼서 페이지 스크롤을 가로채지 않는다. 들여다보기에서만 켠다.
//
// 샘플 모형(public/sample/plan.glb·plan.json)은 팀이 직접 만든 샘플 도면을 변환해 둔 정적 파일이다(서버 없이도 보이게).
// 만든 스크립트는 첫 커밋(09d50ec)의 backend/app/hero_sample.py에 있다.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Button, SpecList, cx } from "@design";

type PlanData = {
  name: string;
  metrics: { widthM: number; depthM: number; floorAreaM2: number; heightM: number; mode: "outline" | "centerline" };
  lines: Record<"door" | "window" | "furniture", number[]>;
};

type Api = { inspect: (p?: THREE.Vector3) => void; overview: () => void };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function cssColor(name: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || "gray");
}

export function HeroModel() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [ready, setReady] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/sample/plan.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PlanData) => alive && setPlan(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!plan) return;
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // 바탕은 페이지 색 그대로 — 상자 없이 물건만 떠 있게
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const H = plan.metrics.heightM;
    const span = Math.max(plan.metrics.widthM, plan.metrics.depthM);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.32; // 바닥 아래로는 돌아가지 않게
    controls.minDistance = span * 0.25;
    controls.maxDistance = span * 4;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-span * 0.6, span * 1.4, span * 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 6;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -span;
    sc.right = sc.top = span;
    sc.far = span * 5;
    scene.add(sun);

    // 바닥 그림자 받는 면 — 그림자만 보이고 면은 투명
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 4, span * 4), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.051;
    ground.receiveShadow = true;
    scene.add(ground);

    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), H + 0.01);
    const pickables: THREE.Object3D[] = [];
    let walls: THREE.Object3D | null = null;

    // 전체 보기 카메라 — 비스듬히 위에서, 모형이 화면 가운데를 채우게
    const home = { target: new THREE.Vector3(0, H * 0.25, 0), pos: new THREE.Vector3() };
    const placeHome = () => {
      const narrow = camera.aspect < 1.1;
      const dist = (span * (narrow ? 0.85 : 0.66)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, camera.aspect * 0.55);
      home.pos.set(dist * 0.62, dist * 0.62, dist * 0.78).add(home.target);
    };

    // 짧은 움직임(트윈) — 매 프레임 진행. 움직임 줄이기면 바로 끝 값.
    type Tween = { t0: number; dur: number; step: (k: number) => void; ease: (t: number) => number };
    let tweens: Tween[] = [];
    const tween = (dur: number, step: (k: number) => void, ease = easeInOut, delay = 0) => {
      if (reducedMotion()) return step(1);
      tweens.push({ t0: performance.now() + delay, dur, step, ease });
    };
    const moveCamera = (toPos: THREE.Vector3, toTarget: THREE.Vector3, toCut: number) => {
      const p0 = camera.position.clone();
      const t0 = controls.target.clone();
      const c0 = clip.constant;
      tweens = tweens.filter((t) => t.dur > 1000); // 이전 카메라 이동은 버리고 솟아오르기는 둔다
      tween(700, (k) => {
        camera.position.lerpVectors(p0, toPos, k);
        controls.target.lerpVectors(t0, toTarget, k);
        clip.constant = c0 + (toCut - c0) * k;
      });
    };

    api.current = {
      inspect: (p) => {
        const at = (p ?? new THREE.Vector3()).clone();
        at.y = 0;
        // 지금 보는 방향 그대로 가까이 — 방향이 갑자기 바뀌지 않게
        const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
        const d = span * 0.8;
        const pos = at.clone().addScaledVector(dir, d * 0.6).setY(d * 1.05);
        controls.enableZoom = true;
        moveCamera(pos, at, H * 0.55); // 사람 눈높이 아래로 잘라 방 안이 보이게
        setInspecting(true);
      },
      overview: () => {
        controls.enableZoom = false;
        moveCamera(home.pos.clone(), home.target.clone(), H + 0.01);
        setInspecting(false);
      },
    };

    new GLTFLoader().load(
      "/sample/plan.glb",
      (gltf) => {
        const edge = cssColor("--color-ink-3");
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.clippingPlanes = [clip];
          mat.side = THREE.DoubleSide;
          m.castShadow = true;
          m.receiveShadow = true;
          m.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(m.geometry, 30),
            new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.5, clippingPlanes: [clip] }),
          ));
          pickables.push(m);
        });
        walls = gltf.scene; // 노드 안에 Z위→Y위 회전이 들어 있어서, 회전 없는 바깥 묶음을 세로(Y)로 늘린다
        scene.add(gltf.scene);

        // 벽이 아닌 도면 선(문·창·가구)을 바닥에 — 평면도가 그대로 바닥이 된 것처럼
        const tone: Record<keyof PlanData["lines"], [string, number]> = {
          door: ["--color-ink-2", 0.85],
          window: ["--color-ink-2", 0.85],
          furniture: ["--color-line-strong", 0.7],
        };
        (Object.keys(plan.lines) as (keyof PlanData["lines"])[]).forEach((k) => {
          const a = plan.lines[k];
          const pts = new Float32Array((a.length / 4) * 6);
          for (let i = 0, j = 0; i < a.length; i += 4, j += 6) pts.set([a[i], 0.004, a[i + 1], a[i + 2], 0.004, a[i + 3]], j);
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
          scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cssColor(tone[k][0]), transparent: true, opacity: tone[k][1] })));
        });

        // 처음 한 번: 바닥 선에서 벽이 솟아오른다
        if (walls) {
          walls.scale.y = 0.001;
          tween(1400, (k) => walls && (walls.scale.y = Math.max(0.001, k)), easeOut, 250);
        }
        setReady(true);
      },
      undefined,
      () => setFailed(true),
    );

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      placeHome();
      if (!api.current || !controls.enableZoom) {
        camera.position.copy(home.pos);
        controls.target.copy(home.target);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // 누르기 = 움직이지 않고 떼기. 끌기(돌리기)와 구분한다.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(pickables, false)[0];
    };
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY, t: performance.now() });
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 400;
      down = null;
      if (moved > 6 || !quick) return;
      const h = hit(e);
      if (h) api.current?.inspect(h.point);
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      renderer.domElement.style.cursor = hit(e) ? "zoom-in" : "grab";
    };
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointermove", onMove);
    cv.style.cursor = "grab";

    // 화면 밖에 있으면 그리지 않는다 (배터리·GPU 아끼기)
    let visible = true;
    const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting));
    io.observe(el);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      tweens = tweens.filter((tw) => {
        const t = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
        if (now >= tw.t0) tw.step(tw.ease(t));
        return t < 1;
      });
      if (!visible) return;
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
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
  }, [plan]);

  // Esc로 전체 보기로 돌아가기
  useEffect(() => {
    if (!inspecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api.current?.overview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspecting]);

  if (failed) return null; // 3D를 못 그리는 환경이면 첫 화면은 글과 업로드만으로도 완결된다

  const m = plan?.metrics;
  return (
    <div className="relative">
      <div
        ref={host}
        role="img"
        aria-label="샘플 평면도를 3D로 세운 모형 — 끌어서 돌리고, 눌러서 가까이 들여다볼 수 있어요"
        className="relative aspect-4/3 w-full touch-pan-y sm:aspect-16/10 lg:aspect-21/9 [&>canvas]:block [&>canvas]:size-full"
      >
        {!ready ? <span className="absolute inset-0 grid place-items-center text-body-sm text-ink-3">모형을 세우는 중…</span> : null}
      </div>

      {m ? (
        <SpecList
          dense
          className={cx("hidden transition-opacity lg:block duration-200 lg:absolute lg:top-0 lg:left-0 lg:mt-0 lg:w-64", inspecting && "lg:pointer-events-none lg:opacity-0")}
          items={[
            { label: "도면", value: plan!.name },
            { label: "크기", value: `${m.widthM} × ${m.depthM}`, unit: "m" },
            { label: "바닥 면적", value: m.floorAreaM2.toFixed(1), unit: "㎡" },
            { label: "벽 높이", value: m.heightM.toFixed(1), unit: "m" },
            { label: "벽 방식", value: m.mode === "outline" ? "두 줄" : "중심선" },
          ]}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 lg:absolute lg:right-0 lg:bottom-0 lg:mt-0 lg:justify-end">
        <p className="text-label text-ink-3" aria-live="polite">
          {inspecting ? "휠·두 손가락으로 확대 · 다른 곳을 눌러 옮기기 · Esc로 돌아가기" : "끌어서 돌려 보기 · 눌러서 들여다보기"}
        </p>
        {ready ? (
          <Button variant="secondary" onClick={() => (inspecting ? api.current?.overview() : api.current?.inspect())}>
            {inspecting ? "전체 보기" : "들여다보기"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
