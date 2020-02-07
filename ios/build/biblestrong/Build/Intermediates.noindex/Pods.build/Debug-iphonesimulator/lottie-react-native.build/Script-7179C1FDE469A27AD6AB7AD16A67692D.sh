#!/bin/sh
COMPATIBILITY_HEADER_PATH="${BUILT_PRODUCTS_DIR}/Swift Compatibility Header/${PRODUCT_MODULE_NAME}-Swift.h"
MODULE_MAP_PATH="${BUILT_PRODUCTS_DIR}/${PRODUCT_MODULE_NAME}.modulemap"

ditto "${DERIVED_SOURCES_DIR}/${PRODUCT_MODULE_NAME}-Swift.h" "${COMPATIBILITY_HEADER_PATH}"
ditto "${PODS_ROOT}/Headers/Public/lottie_react_native/lottie-react-native.modulemap" "${MODULE_MAP_PATH}"
ditto "${PODS_ROOT}/Headers/Public/lottie_react_native/lottie-react-native-umbrella.h" "${BUILT_PRODUCTS_DIR}"
printf "\n\nmodule ${PRODUCT_MODULE_NAME}.Swift {\n  header \"${COMPATIBILITY_HEADER_PATH}\"\n  requires objc\n}\n" >> "${MODULE_MAP_PATH}"

