// Typage minimal propre au harnais web, sans dépendance ajoutée à l'application.
declare module 'react-dom/client' {
  export function createRoot(element: Element): { render(children: import('react').ReactNode): void };
}
