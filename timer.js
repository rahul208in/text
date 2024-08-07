// timer.js

class Timer {
    constructor(duration, updateCallback, completeCallback) {
        this.duration = duration;
        this.updateCallback = updateCallback;
        this.completeCallback = completeCallback;
        this.remainingTime = duration;
        this.interval = null;
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.remainingTime = this.duration;
        this.interval = setInterval(() => {
            this.remainingTime -= 1;
            this.updateCallback(this.remainingTime);
            if (this.remainingTime <= 0) {
                clearInterval(this.interval);
                this.completeCallback();
            }
        }, 1000);
    }

    reset() {
        clearInterval(this.interval);
        this.remainingTime = this.duration;
        this.updateCallback(this.remainingTime);
    }
}

module.exports = Timer;
