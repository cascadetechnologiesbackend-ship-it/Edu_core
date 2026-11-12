module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@hookform/resolvers") {
        pkg.peerDependencies = {
          ...(pkg.peerDependencies || {}),
          zod: "^3.25.76",
        };
      }
      return pkg;
    },
  },
};

