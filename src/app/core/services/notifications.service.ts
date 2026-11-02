import { Service, signal } from '@angular/core';

// Placeholder: el conteo vendrá del backend.
@Service()
export class NotificationsService {
  readonly unread = signal(3);
}
