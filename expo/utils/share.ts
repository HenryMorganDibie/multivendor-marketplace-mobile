import { Platform, Share } from 'react-native';

interface ShareOptions {
  message: string;
  title?: string;
  url?: string;
}

export async function safeShare(options: ShareOptions): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: options.title,
          text: options.message,
          url: options.url,
        });
      } else {
        await navigator.clipboard.writeText(options.url || options.message);
        console.log('[share] Copied to clipboard (web fallback)');
      }
      return;
    }

    const content: { message: string; url?: string; title?: string } = {
      message: options.message,
    };
    if (options.url) content.url = options.url;
    if (options.title) content.title = options.title;

    await Share.share(content);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'User did not share') {
      return;
    }
    console.warn('[share] safeShare error:', error);
  }
}
