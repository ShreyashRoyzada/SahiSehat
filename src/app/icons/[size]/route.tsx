import { ImageResponse } from "next/og";

export async function GET(_: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = (await ctx.params).size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b6249" }}>
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64">
          <path d="M14 34l11 11 25-27" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
