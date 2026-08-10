export const getKopSuratImage = () => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = '/kop_surat.png';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
};

export const addKopSuratToPDF = async (doc, orientation = 'portrait') => {
  const img = await getKopSuratImage();
  if (img) {
    const pageWidth = orientation === 'landscape' ? 297 : 210;
    const width = 190;
    // img.width = 795, img.height = 197 => height = 190 * (197 / 795) = ~47mm
    const height = (img.height / img.width) * width;
    const x = (pageWidth - width) / 2;
    doc.addImage(img, 'PNG', x, 10, width, height);
    return 10 + height + 5; // Return the next safe Y-coordinate (around 62mm)
  }
  return 20; // Default safe Y-coordinate if image fails to load
};
