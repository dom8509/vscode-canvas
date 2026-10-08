// esbuild bundles the board's stylesheet as text, for an export to carry it.
declare module "*.css" {
  const text: string;
  export default text;
}
