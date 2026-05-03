import { useTheme } from "@/shared/theme/ThemeProvider";

export default function SlideScreenshot({ image, alt, variant = "desktop" }) {
  const { theme } = useTheme();
  const src = theme === "dark" ? image.dark : image.light;
  const isPhone = variant === "phone";
  return (
    <div className={`ps-screenshot-window${isPhone ? " ps-screenshot-window--phone" : ""}`}>
      {!isPhone && (
        <div className="ps-screenshot-chrome">
          <span className="ps-screenshot-dot" />
          <span className="ps-screenshot-dot" />
          <span className="ps-screenshot-dot" />
        </div>
      )}
      <div className="ps-screenshot-frame">
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
