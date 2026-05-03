import { useTheme } from "@/shared/theme/ThemeProvider";

export default function SlideScreenshot({ image, alt }) {
  const { theme } = useTheme();
  const src = theme === "dark" ? image.dark : image.light;
  return (
    <div className="ps-screenshot-window">
      <div className="ps-screenshot-chrome">
        <span className="ps-screenshot-dot" />
        <span className="ps-screenshot-dot" />
        <span className="ps-screenshot-dot" />
      </div>
      <div className="ps-screenshot-frame">
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
