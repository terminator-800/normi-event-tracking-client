import csgLogo from "../assets/CSG LOGO.jpg";

export default function SidebarBrand() {
  return (
    <div className="p-6 space-y-4">
      <img
        src={csgLogo}
        alt="Central Student Government"
        className="mx-auto h-16 w-16 rounded-full bg-white/10 object-contain"
      />
      <p className="text-center text-xs font-medium uppercase tracking-wider font-[Inter,sans-serif] text-white">
        Central Student Government
      </p>
    </div>
  );
}
