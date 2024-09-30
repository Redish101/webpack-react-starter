const WebpackBar = require("webpackbar");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require("html-webpack-plugin");
const LightningCSS = require("lightningcss");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const { LightningCssMinifyPlugin } = require("lightningcss-loader");
const isDevelopment = process.env.NODE_ENV !== "production";
const isAnalyze = !!process.env.ANALYZE;
const topLevelFrameworkPaths = isDevelopment ? [] : getTopLevelFrameworkPaths();

/** @type {import('webpack').Configuration} */
const webpackConfig = {
  mode: isDevelopment ? "development" : "production",
  entry: path.resolve(__dirname, "src", "main.tsx"),
  output: {
    library: "_101",
    path: path.resolve(__dirname, "dist"),
    filename: isDevelopment ? "[name].js" : "[contenthash].js",
    cssFilename: isDevelopment ? "[name].css" : "[contenthash].css",
    hotUpdateChunkFilename: "[id].[fullhash].hot-update.js",
    hotUpdateMainFilename: "[fullhash].[runtime].hot-update.json",
    webassemblyModuleFilename: "[contenthash].wasm",
    asyncChunks: true,
    crossOriginLoading: "anonymous",
    hashFunction: "xxhash64",
    hashDigestLength: 16,
  },
  devtool: isDevelopment ? "eval-cheap-module-source-map" : false,
  devServer: {
    port: 3000,
    historyApiFallback: true,
  },
  plugins: [
    !isDevelopment && new WebpackBar(),
    isDevelopment && new ReactRefreshWebpackPlugin(),
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: isDevelopment ? "[name].css" : "[contenthash].css",
    }),
    !isDevelopment &&
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
        terserOptions: {
          compress: {
            ecma: 5,
            comparisons: false,
            inline: 2,
          },
          mangle: { safari10: true },
          format: {
            ecma: 2015,
            safari10: true,
            comments: false,
            ascii_only: true,
          },
        },
      }),
    !isDevelopment && new LightningCssMinifyPlugin(),
    isAnalyze &&
      new BundleAnalyzerPlugin({
        analyzerMode: "static",
      }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "index.html"),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(m?ts|tsx)$/,
        exclude: /(node_modules)/,
        use: {
          loader: "swc-loader",
          /** @type {import('@swc/core').Options} */
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              externalHelpers: true,
              loose: false,
              transform: {
                react: {
                  runtime: "automatic",
                  refresh: isDevelopment,
                  development: isDevelopment,
                },
                optimizer: {
                  simplify: true,
                  globals: {
                    typeofs: {
                      window: "object",
                    },
                    envs: {
                      NODE_ENV: isDevelopment
                        ? '"development"'
                        : '"production"',
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "lightningcss-loader",
            options: {
              implementation: LightningCSS,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    plugins: [
      new TsconfigPathsPlugin({
        extensions: [".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".js", ".json"],
      }),
    ],
    extensions: [".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".js", ".json"],
    cache: true,
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        framework: {
          chunks: "all",
          name: "framework",
          test(module) {
            const resource = module.nameForCondition?.();
            return resource
              ? topLevelFrameworkPaths.some((pkgPath) =>
                  resource.startsWith(pkgPath),
                )
              : false;
          },
          priority: 40,
          enforce: true,
        },
      },
    },
    runtimeChunk: {
      name: "webpack",
    },
  },
  cache: {
    type: "filesystem",
    maxMemoryGenerations: isDevelopment ? 5 : Infinity,
    cacheDirectory: path.join(__dirname, "node_modules", ".cache", "webpack"),
    compression: isDevelopment ? "gzip" : false,
  },
};

function getTopLevelFrameworkPaths(
  frameworkPackages = ["react", "react-dom"],
  dir = path.resolve(__dirname),
) {
  const topLevelFrameworkPaths = [];
  const visitedFrameworkPackages = new Set();

  const addPackagePath = (packageName, relativeToPath) => {
    try {
      if (visitedFrameworkPackages.has(packageName)) return;
      visitedFrameworkPackages.add(packageName);

      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [relativeToPath],
      });

      const directory = path.join(packageJsonPath, "../");

      if (topLevelFrameworkPaths.includes(directory)) return;
      topLevelFrameworkPaths.push(directory);

      const dependencies = require(packageJsonPath).dependencies || {};
      for (const name of Object.keys(dependencies)) {
        addPackagePath(name, directory);
      }
    } catch {}
  };

  for (const packageName of frameworkPackages) {
    addPackagePath(packageName, dir);
  }

  return topLevelFrameworkPaths;
}

module.exports = webpackConfig;
