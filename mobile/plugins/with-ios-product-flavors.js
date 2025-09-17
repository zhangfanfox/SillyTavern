const { withXcodeProject } = require('@expo/config-plugins');

function withIosProductFlavors(config, { devclientId, prodId }) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    
    // Update the default Debug configuration for dev client
    project.updateBuildProperty('PRODUCT_BUNDLE_IDENTIFIER', devclientId, 'Debug');
    project.updateBuildProperty('PRODUCT_NAME', 'ChatDev', 'Debug');
    
    // Update the default Release configuration for prod
    project.updateBuildProperty('PRODUCT_BUNDLE_IDENTIFIER', prodId, 'Release');
    project.updateBuildProperty('PRODUCT_NAME', 'ChatProd', 'Release');

    return config;
  });
}

module.exports = withIosProductFlavors;