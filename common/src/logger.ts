export class Logger {
    private context: string;

    constructor(context?: string) { // Make context optional
        this.context = context || 'default';
    }

    info(message: string) {
        console.log(`[${this.context}] Info: ${message}`);
    }

    error(message: string) {
        console.error(`[${this.context}] Error: ${message}`);
    }
}
