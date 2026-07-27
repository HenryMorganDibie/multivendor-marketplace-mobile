import { Alert as RNAlert, Platform } from 'react-native';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type AlertListener = (config: AlertConfig | null) => void;

let _listener: AlertListener | null = null;

export function registerAlertListener(fn: AlertListener) {
  _listener = fn;
}

export const Alert = {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => {
    if (Platform.OS === 'web' && _listener) {
      _listener({ title, message, buttons });
    } else {
      RNAlert.alert(title, message ?? '', buttons as Parameters<typeof RNAlert.alert>[2]);
    }
  },
  prompt: (
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButton[],
    _type?: string,
    defaultValue?: string,
    _keyboardType?: string
  ) => {
    if (Platform.OS === 'ios') {
      (RNAlert as any).prompt(title, message, callbackOrButtons, _type, defaultValue, _keyboardType);
    } else {
      // On Android and Web, simulate prompt with an alert
      const buttons: AlertButton[] = Array.isArray(callbackOrButtons)
        ? callbackOrButtons
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'OK',
              onPress: () => {
                if (typeof callbackOrButtons === 'function') {
                  callbackOrButtons(defaultValue ?? '');
                }
              },
            },
          ];
      if (Platform.OS === 'web' && _listener) {
        _listener({ title, message, buttons });
      } else {
        RNAlert.alert(title, message ?? '', buttons as Parameters<typeof RNAlert.alert>[2]);
      }
    }
  },
};
