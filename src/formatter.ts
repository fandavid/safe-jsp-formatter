import * as beautify from 'js-beautify';

export function formatJsp(text: string, options: { tabSize: number, insertSpaces: boolean }): string {
    const placeholders: string[] = [];
    
    // Use a unique marker
    const marker = `ZJSP${Math.random().toString(36).substring(2, 6).toUpperCase()}Z`;

    // 1. Identify and Pre-format JSP Tags
    const jspPattern = /<%[\s\S]*?%>/g;
    
    let processedText = text.replace(jspPattern, (match) => {
        let finalContent = match;
        
        // Format Java Scriptlets (excluding directives <%@, expressions <%=, and comments <%--)
        if (match.startsWith('<%') && !['@', '=', '-'].includes(match[2])) {
            const innerCode = match.substring(2, match.length - 2).trim();
            
            // Normalize the code: collapse all whitespace to single spaces first
            // This prevents js-beautify from preserving incorrect line breaks
            const normalizedCode = innerCode.replace(/\s+/g, ' ').trim();
            
            const formattedInner = beautify.js(normalizedCode, {
                indent_size: options.tabSize,
                indent_char: options.insertSpaces ? ' ' : '\t',
                preserve_newlines: true,
                wrap_line_length: 0 // Prevent breaking Java lines
            });
            
            const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
            const indentedLines = formattedInner.split('\n')
                .map(line => line.trim() ? indent + line : '')
                .join('\n');
            finalContent = `<%\n${indentedLines}\n%>`;
        }

        const placeholder = `${marker}${placeholders.length}${marker}`;
        placeholders.push(finalContent);
        return placeholder;
    });

    // 2. Format HTML
    const beautifyOptions: beautify.HTMLBeautifyOptions = {
        indent_size: options.tabSize,
        indent_char: options.insertSpaces ? ' ' : '\t',
        max_preserve_newlines: 2,
        preserve_newlines: true,
        indent_scripts: 'keep',
        end_with_newline: true,
        wrap_line_length: 0,
        indent_inner_html: false,
        indent_empty_lines: false,
        templating: ['erb'],
        unformatted: ['pre', 'code', 'textarea'],
        content_unformatted: ['title'],
        // Ensure that top-level JSP tags (placeholders) are treated as block-ish
        extra_liners: [] 
    };

    let formattedText = beautify.html(processedText, beautifyOptions);

    // 3. Restore JSP Tags
    for (let i = 0; i < placeholders.length; i++) {
        const placeholder = `${marker}${i}${marker}`;
        formattedText = formattedText.split(placeholder).join(placeholders[i]);
    }

    // 4. Post-processing Cleanup
    // Force <title> to be a single line
    formattedText = formattedText.replace(/<title>([\s\S]*?)<\/title>/gi, (match, p1) => {
        if (typeof p1 !== 'string') {
            return match;
        }
        const cleanContent = p1.replace(/\s+/g, ' ').trim();
        return `<title>${cleanContent}</title>`;
    });

    // Ensure directives at the top stay on their own lines and aren't squashed
    // Only match directives (<%@ ... %>), not expressions (<%=) or scriptlets (<%)
    // Use a more specific pattern that doesn't cross into other JSP tags
    formattedText = formattedText.replace(/(<%@[^%]*%>)(?![\r\n])/g, '$1\n');

    // Fix mangled < script
    formattedText = formattedText.replace(/<\s+script/g, '<script');
    
    // Fix attribute spacing
    formattedText = formattedText.replace(/(\s[a-zA-Z0-9_-]+)\s*=\s*(["'])/g, '$1=$2');

    // Fix JSP tag mangling
    formattedText = formattedText.replace(/%\s+>/g, '%>');

    return formattedText;
}