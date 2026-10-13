export const pasteSourceFixtures = [
  {
    source: 'Google Docs',
    plainText: 'Opening\u00a0line\r\n\r\n\r\nSecond\tline',
    html: '<meta charset="utf-8"><b style="font-weight:700">Opening&nbsp;line</b><br><br><span style="color:red">Second line</span>',
    expected: 'Opening line\n\nSecond line',
  },
  {
    source: 'Microsoft Word',
    plainText: '\ufeff“First paragraph”\r\n\r\n\r\nSecond\u202fparagraph\u200b',
    html: '<p class="MsoNormal" style="margin:0"><span lang="EN-US">“First paragraph”</span></p><xml>foreign metadata</xml>',
    expected: '“First paragraph”\n\nSecond paragraph',
  },
  {
    source: 'Notion',
    plainText: 'Scene one\n\n  • First point\n\t• Second point  ',
    html: '<div data-block-id="abc"><div class="notion-text-block">Scene one</div><ul><li>First point</li><li>Second point</li></ul></div>',
    expected: 'Scene one\n\n• First point\n• Second point',
  },
  {
    source: 'ChatGPT',
    plainText: 'Here’s the opening — keep it.\n\n1. First beat\n2. Second beat',
    html: '<div class="markdown prose"><p>Here’s the opening — keep it.</p><ol><li>First beat</li><li>Second beat</li></ol></div>',
    expected: 'Here’s the opening — keep it.\n\n1. First beat\n2. Second beat',
  },
  {
    source: 'Email',
    plainText: 'Hello team,  \r\n\r\nThe session starts at 10:00.\r\n\r\nThanks,\r\nAlex',
    html: '<div style="font-family:Arial"><p>Hello team,</p><p>The session starts at <a href="https://example.com">10:00</a>.</p><p>Thanks,<br>Alex</p></div>',
    expected: 'Hello team,\n\nThe session starts at 10:00.\n\nThanks,\nAlex',
  },
  {
    source: 'Website',
    plainText: 'Article title\u2029First\u2009paragraph with spaced words.\u2028Still the same paragraph.\n\nFinal paragraph.\ufffc',
    html: '<article><h1>Article title</h1><script>steal()</script><p>First paragraph with spaced words.<br>Still the same paragraph.</p><p>Final paragraph.</p></article>',
    expected: 'Article title\n\nFirst paragraph with spaced words.\nStill the same paragraph.\n\nFinal paragraph.',
  },
]
