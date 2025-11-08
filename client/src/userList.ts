import { User } from './types';

interface UserListOptions {
    userListElement: HTMLElement;
}

export class UserList {
    private userListElement: HTMLElement;
    private users: Map<string, User> = new Map();

    constructor(options: UserListOptions) {
        this.userListElement = options.userListElement;
    }

    public updateUser(user: User) {
        this.users.set(user.id, user);
        this.render();
    }

    public removeUser(userId: string) {
        this.users.delete(userId);
        this.render();
    }

    public getUsers(): User[] {
        return Array.from(this.users.values());
    }

    public render() {
        this.userListElement.innerHTML = '';

        const sortedUsers = Array.from(this.users.values()).sort((a, b) =>
            a.username.localeCompare(b.username)
        );

        sortedUsers.forEach(user => {
            const listItem = document.createElement('li');
            listItem.className = 'user-list-item';
            listItem.dataset.userId = user.id;

            const colorIndicator = document.createElement('span');
            colorIndicator.className = 'user-color-indicator';
            colorIndicator.style.backgroundColor = user.color;

            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = user.username === 'Anonymous' ? `User ${user.id.substring(0, 4)}` : user.username;

            listItem.appendChild(colorIndicator);
            listItem.appendChild(usernameSpan);
            this.userListElement.appendChild(listItem);
        });
    }
}

