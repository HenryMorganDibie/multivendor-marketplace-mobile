import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface HelpArticleBodyProps {
  content: string;
}

/**
 * Renders Help Center article content with light styling.
 * Supported markup (per block separated by blank lines):
 * - "## Heading" → section heading
 * - lines starting with "•" → bullet list
 * - a non-bullet first line followed by bullets → sub-heading + bullets
 * - everything else → paragraph (numbered "1." lines render as paragraphs)
 */
function HelpArticleBodyBase({ content }: HelpArticleBodyProps) {
  const blocks = content.split('\n\n').filter((b) => b.trim());

  return (
    <View>
      {blocks.map((block, index) => {
        const lines = block.split('\n').filter((l) => l.trim());

        if (lines.length === 0) {
          return null;
        }

        const hasBullets = lines.some((l) => l.trim().startsWith('•'));
        const firstIsBullet = lines[0].trim().startsWith('•');

        if (hasBullets) {
          const leadLine = !firstIsBullet ? lines[0] : null;
          const rest = !firstIsBullet ? lines.slice(1) : lines;

          return (
            <View key={index} style={styles.block}>
              {leadLine && (
                <Text style={styles.subheading}>{cleanHeading(leadLine)}</Text>
              )}
              {rest.map((line, lineIndex) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('•')) {
                  return (
                    <View key={lineIndex} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.bulletText}>
                        {trimmed.replace(/^•\s*/, '')}
                      </Text>
                    </View>
                  );
                }
                return (
                  <Text key={lineIndex} style={styles.paragraph}>
                    {trimmed}
                  </Text>
                );
              })}
            </View>
          );
        }

        if (lines[0].trim().startsWith('## ')) {
          return (
            <View key={index} style={styles.block}>
              <Text style={styles.heading}>{cleanHeading(lines[0])}</Text>
              {lines.slice(1).map((line, lineIndex) => (
                <Text key={lineIndex} style={styles.paragraph}>
                  {line.trim()}
                </Text>
              ))}
            </View>
          );
        }

        return (
          <Text key={index} style={[styles.paragraph, styles.block]}>
            {block.replace(/\n/g, ' ')}
          </Text>
        );
      })}
    </View>
  );
}

function cleanHeading(line: string): string {
  return line.replace(/^##\s*/, '').trim();
}

export default React.memo(HelpArticleBodyBase);

const styles = StyleSheet.create({
  block: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 26,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  bulletRow: {
    flexDirection: 'row' as const,
    marginBottom: 8,
    paddingRight: 4,
  },
  bullet: {
    fontSize: 15,
    color: Colors.primary,
    marginRight: 10,
    lineHeight: 23,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },
});
