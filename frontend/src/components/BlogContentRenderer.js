import React from 'react';
import { API_URL } from '../utils/api';

const resolveImgUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_URL}${url}`;
  return `${API_URL}/${url}`;
};

/**
 * Parses inline text for bold (**text**), italic (*text*), links ([text](url)), and code (`code`).
 */
const renderInline = (text) => {
  if (!text) return null;

  // Tokenize string with regex capturing formatting
  const regex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\)|\`.*?\`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-[#1D1D1F]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-[#1D1D1F]/95">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="text-xs font-mono bg-[#F5F5F7] px-1.5 py-0.5 rounded border border-[#E5E5EA] text-[#FF6600]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (match) {
        return (
          <a
            key={index}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6600] font-medium underline underline-offset-4 decoration-[#FF6600]/40 hover:decoration-[#FF6600] transition-colors"
          >
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
};

/**
 * Parses image block options:
 * Markdown format: ![Caption | rounded-2xl | align-center](url)
 */
const parseImageTag = (line) => {
  const match = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
  if (!match) return null;

  const rawMeta = match[1] || '';
  const url = match[2];

  const metaParts = rawMeta.split('|').map((p) => p.trim());
  const caption = metaParts[0] || '';

  // Extract rounded border class
  let roundedClass = 'rounded-2xl'; // Default Apple rounded
  let alignClass = 'w-full';

  for (const part of metaParts) {
    if (part === 'rounded-none') roundedClass = 'rounded-none';
    if (part === 'rounded-xl') roundedClass = 'rounded-xl';
    if (part === 'rounded-2xl') roundedClass = 'rounded-2xl';
    if (part === 'rounded-3xl') roundedClass = 'rounded-3xl';
    if (part === 'rounded-full') roundedClass = 'rounded-full';

    if (part === 'align-center') alignClass = 'max-w-xl mx-auto';
    if (part === 'align-left') alignClass = 'max-w-md mr-auto';
    if (part === 'align-right') alignClass = 'max-w-md ml-auto';
  }

  return {
    url: resolveImgUrl(url),
    caption,
    roundedClass,
    alignClass,
  };
};

export const BlogContentRenderer = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-2 my-5 text-[#1D1D1F]/90 text-base sm:text-[17px] pl-2">
          {currentList.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check for Image tag: ![alt](url)
    const imgData = parseImageTag(line);
    if (imgData) {
      flushList();
      elements.push(
        <figure key={`img-${i}`} className={`my-8 ${imgData.alignClass}`}>
          <div
            className={`overflow-hidden border border-[#E5E5EA] shadow-sm bg-[#F5F5F7] ${imgData.roundedClass} transition-transform duration-300 hover:shadow-md`}
          >
            <img
              src={imgData.url}
              alt={imgData.caption || 'Illustration article'}
              className="w-full h-auto max-h-[600px] object-cover"
              loading="lazy"
            />
          </div>
          {imgData.caption && (
            <figcaption className="text-xs text-center text-[#86868B] mt-2.5 italic">
              {imgData.caption}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    // Check for unordered list item (- or *)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.slice(2));
      continue;
    } else {
      flushList();
    }

    // Empty line
    if (!line) {
      continue;
    }

    // Separator ---
    if (line === '---' || line === '***') {
      elements.push(
        <hr key={`hr-${i}`} className="border-t border-[#E5E5EA] my-8" />
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] mt-8 mb-3 tracking-tight"
        >
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] mt-10 mb-4 tracking-tight"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] mt-10 mb-4 tracking-tight"
        >
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-3 border-[#FF6600] bg-[#F5F5F7] px-5 py-3 my-6 rounded-r-2xl italic text-[#1D1D1F] text-base leading-relaxed"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Standard paragraph
    elements.push(
      <p
        key={`p-${i}`}
        className="leading-relaxed text-[#1D1D1F]/90 text-base sm:text-[17px] my-4 font-normal"
      >
        {renderInline(rawLine)}
      </p>
    );
  }

  flushList();

  return <div className="blog-rendered-content antialiased">{elements}</div>;
};

/**
 * Strips markdown tags and images from a content string to create a clean text excerpt.
 */
export const stripMarkdownForExcerpt = (text, maxLength = 220) => {
  if (!text) return '';
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Keep link text only
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/(\*\*|\*|\`|>|-)/g, '') // Remove markdown formatting symbols
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};
