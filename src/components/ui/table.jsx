import { forwardRef } from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export const Table = forwardRef(function Table(
  { density = "standard", className, ...props },
  ref,
) {
  const densityClass = density === "dense" ? "table-dense" : "table-standard";
  return <table ref={ref} className={cx(densityClass, className)} {...props} />;
});

export const TableHeader = forwardRef(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={className} {...props} />;
});

export const TableBody = forwardRef(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={className} {...props} />;
});

export const TableRow = forwardRef(function TableRow({ className, ...props }, ref) {
  return <tr ref={ref} className={className} {...props} />;
});

export const TableHead = forwardRef(function TableHead({ className, ...props }, ref) {
  return <th ref={ref} className={className} {...props} />;
});

export const TableCell = forwardRef(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={className} {...props} />;
});

export const TableCaption = forwardRef(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={className} {...props} />;
});
