/**
 * Get the page title based on the current route path
 */
export function getPageTitle(pathname: string): string {
  // Remove query parameters and trailing slashes
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '');
  
  // Map paths to titles
  const titleMap: Record<string, string> = {
    '/alumni-profile': 'My Profile',
    '/alumni-profile/chapters': 'Chapters',
    '/alumni-profile/card': 'Alumni Card',
    '/alumni-profile/mentorship': 'Alumni Talk',
    '/alumni-profile/association': 'Alumni Association',
    '/alumni-profile/more-details': 'More Details',
    '/alumni-profile/benefits': 'Benefits',
    '/alumni-profile/scholarship-application': 'Scholarship Application',
    '/alumni-profile/upskill-application': 'Upskill & Reskill Application',
  };
  
  // Check for exact match first
  if (titleMap[cleanPath]) {
    return titleMap[cleanPath];
  }
  
  // Check for dynamic routes (e.g., /alumni-profile/benefits/[slug])
  if (cleanPath.startsWith('/alumni-profile/benefits/')) {
    return 'Benefits';
  }
  
  // Default fallback - extract from path
  const segments = cleanPath.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  
  // Convert kebab-case or camelCase to Title Case
  if (lastSegment) {
    return lastSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  return 'Alumni Portal';
}

