import { fileURLToPath } from "node:url";

const config = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
  },
};

export default config;
