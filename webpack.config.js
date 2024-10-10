const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './client/init.ts',  // Entry point where Webpack starts bundling
  output: {
    filename: 'bundle.min.js',  // Output bundle file name
    path: path.resolve(__dirname, 'public/smartphone'),  // Output folder
    libraryTarget: 'umd',  // Make the output compatible with different module systems
  },
  mode: 'production',  // 'production' mode automatically minifies the bundle
  target: 'web',  // Ensures Webpack bundles for the browser environment

  resolve: {
    extensions: ['.ts', '.js'],  // Resolve both .ts and .js files
  },
  module: {
    rules: [
      {
        test: /\.ts$/,  // For TypeScript files
        use: 'ts-loader',  // Use ts-loader to compile TypeScript into JavaScript
        exclude: /node_modules/,  // Exclude node_modules from processing
      },
      {
        test: /\.css$/,  // For CSS files (optional)
        use: ['style-loader', 'css-loader'],  // Use style-loader and css-loader for CSS
      }
    ],
  },

  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',        // Make $ available globally in your bundle
      jQuery: 'jquery',   // Make jQuery available globally
    }),
  ],
};
