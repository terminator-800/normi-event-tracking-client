import csgLogo from "../assets/csg1.png";

export default function SidebarBrand() {
  return (
    <div className="space-y-3 p-5">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white p-1.5 shadow-sm ring-1 ring-white/40">
        <img
          src={csgLogo}
          alt="Central Student Government"
          className="h-full w-full object-contain"
        />
      </div>
      <p className="text-center font-[Inter,sans-serif] text-xs font-medium uppercase tracking-wider text-white">
        Central Student Government
      </p>
    </div>
  );
}
