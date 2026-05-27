export const AWEMA_CONTACT = {
  whatsappPhone: '+2250707145959',
  whatsappNumber: '2250707145959',          // sans +, pour wa.me
  email: 'webmarketingagence@gmail.com',
  whatsappUrl: (message: string) =>
    `https://wa.me/2250707145959?text=${encodeURIComponent(message)}`,
  mailtoUrl: (subject: string) =>
    `mailto:webmarketingagence@gmail.com?subject=${encodeURIComponent(subject)}`,
};
