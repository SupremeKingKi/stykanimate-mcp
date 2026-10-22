/**
 * The single seam between this server and the vendored StykAnimate core.
 *
 * Everything the tools need from the editor — the document model, the rig
 * evaluator and the native container codec — is re-exported here so the
 * vendored tree can move without touching the tool layer.
 */
export { Editor } from '../vendor/stykanimate/src/editor.mjs';
export {
  buildContainerV1,
  buildContainerV2,
  decodeDocument,
  liftDocument,
  normalizeDecodedDocument,
  validateNativeFigure,
} from '../vendor/stykanimate/src/native-container.mjs';
export { nativeFigureDocument } from '../vendor/stykanimate/src/native-figure.mjs';
export { createStartupDocument, STARTUP_CANVASES } from '../vendor/stykanimate/src/startup-document.mjs';
export { emptyDocument, createDemo, defaultFigure } from '../vendor/stykanimate/src/demo.mjs';
export {
  buildGeometry,
  evaluatedFrame,
  invalidateEvaluationCaches,
  nativeTimeline,
  timeline,
} from '../vendor/stykanimate/src/pivot/geometry.mjs';
export { validateScene, validateSceneSteps, syncDerived } from '../vendor/stykanimate/src/pivot/model.mjs';
export { frameOrder, setOrder } from '../vendor/stykanimate/src/pivot/structure.mjs';
export { prepareEditorLoad, prepareEditorLoadAsync } from '../vendor/stykanimate/src/editor-load.mjs';
