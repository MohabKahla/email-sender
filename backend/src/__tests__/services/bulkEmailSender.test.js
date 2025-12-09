// backend/src/__tests__/services/bulkEmailSender.test.js
const { replaceTemplateVariables } = require('../../services/bulkEmailSender');

describe('bulkEmailSender', () => {
  describe('replaceTemplateVariables', () => {
    test('should replace single variable', () => {
      const text = 'Hello {{name}}!';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello John!');
    });

    test('should replace multiple variables', () => {
      const text = 'Hello {{name}}, you work at {{company}} as a {{position}}.';
      const data = {
        name: 'John Doe',
        company: 'Acme Inc',
        position: 'Developer'
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello John Doe, you work at Acme Inc as a Developer.');
    });

    test('should replace same variable multiple times', () => {
      const text = '{{name}} is great! We love {{name}}!';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('John is great! We love John!');
    });

    test('should remove unreplaced variables', () => {
      const text = 'Hello {{name}}, your {{missing}} is ready.';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello John, your  is ready.');
    });

    test('should handle empty values', () => {
      const text = 'Hello {{name}}!';
      const data = { name: '' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello !');
    });

    test('should handle null/undefined values', () => {
      const text = 'Hello {{name}}, email: {{email}}';
      const data = { name: null, email: undefined };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello , email: ');
    });

    test('should handle empty text', () => {
      const result = replaceTemplateVariables('', { name: 'John' });

      expect(result).toBe('');
    });

    test('should handle null text', () => {
      const result = replaceTemplateVariables(null, { name: 'John' });

      expect(result).toBe('');
    });

    test('should handle text without variables', () => {
      const text = 'Hello, this is a plain text message.';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello, this is a plain text message.');
    });

    test('should handle complex email template', () => {
      const text = `Dear {{name}},

Thank you for your interest in {{position}} at {{company}}.

We will contact you at {{email}} soon.

Best regards,
HR Team`;

      const data = {
        name: 'John Doe',
        position: 'Senior Developer',
        company: 'Acme Inc',
        email: 'john@example.com'
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toContain('Dear John Doe,');
      expect(result).toContain('Senior Developer at Acme Inc');
      expect(result).toContain('contact you at john@example.com');
    });

    test('should handle special characters in values', () => {
      const text = 'Hello {{name}}!';
      const data = { name: 'John & Jane (Friends)' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello John & Jane (Friends)!');
    });

    test('should handle HTML in template', () => {
      const text = '<h1>Hello {{name}}</h1><p>Welcome to {{company}}!</p>';
      const data = {
        name: 'John Doe',
        company: 'Acme Inc'
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('<h1>Hello John Doe</h1><p>Welcome to Acme Inc!</p>');
    });

    test('should handle variables with underscores and numbers', () => {
      const text = 'Order {{order_id}} for {{user_name_1}}';
      const data = {
        order_id: '12345',
        user_name_1: 'John'
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Order 12345 for John');
    });

    test('should not replace malformed variable syntax', () => {
      const text = 'Hello {name} and {{name}';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello {name} and {{name}');
    });

    test('should handle numeric values', () => {
      const text = 'Your order #{{order_number}} costs ${{price}}';
      const data = {
        order_number: 12345,
        price: 99.99
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Your order #12345 costs $99.99');
    });

    test('should handle case-sensitive variable names', () => {
      const text = 'Hello {{Name}} and {{name}}';
      const data = {
        Name: 'JOHN',
        name: 'john'
      };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello JOHN and john');
    });

    test('should handle empty data object', () => {
      const text = 'Hello {{name}}!';
      const data = {};

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello !');
    });

    test('should preserve line breaks', () => {
      const text = 'Hello {{name}},\n\nThank you!\n\nBest,\nTeam';
      const data = { name: 'John' };

      const result = replaceTemplateVariables(text, data);

      expect(result).toBe('Hello John,\n\nThank you!\n\nBest,\nTeam');
    });
  });
});
