import { otel } from 'eve/instrumentation/otel';
export default otel({
  resource: { 'service.name': 'no-touch-assistant', 'deployment.environment': 'local-demo' },
  tracePolicy: () => ({ emit: true, recordInputs: false, recordOutputs: false }),
});
