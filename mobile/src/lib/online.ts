import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { readIsOnline } from './onlineState';

export { readIsOnline } from './onlineState';

let online = true;

function apply(state: NetInfoState): void {
  online = readIsOnline(state);
}

export function initOnlineSignal(): void {
  NetInfo.fetch().then(apply).catch(() => {
    online = true;
  });
  NetInfo.addEventListener(apply);
}

export function isOnline(): boolean {
  return online;
}
