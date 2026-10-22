// A small queue of work that is spread over frames.
//
// The world is built as you fly: terrain chunks, a track's mesh (40-70 ms in one
// go), an AI car's lap. None of it may take a frame to itself, so each is a JOB
// that does one bounded piece of work when asked and says whether it is finished,
// and the Streamer gives the jobs a few milliseconds a frame (OPEN_WORLD
// .chunkBudgetMs), highest priority first.
//
// A job that is never at the front would starve, and a lap that is never
// recorded is a track with no cars on it, so a job that has been passed over for
// `maxWait` pieces of work goes first the next time.
//
// There is no worker. Everything a job does is a pure function of its inputs, so
// one could host it unchanged, but a measurement (npm run world) says the main
// thread keeps ahead at Mach 2 with room to spare.

const now = () => performance.now();

export class Streamer {
  constructor(maxWait = 12) {
    this.jobs = [];
    this.maxWait = maxWait;
    this.lastMs = 0;
    this.lastSteps = 0;
  }

  // job: { name, priority, step() -> true when there is nothing more to do }.
  // Adding a job that is already queued (same name) does nothing, so a caller can
  // simply ask every frame.
  add(job) {
    if (this.jobs.some((j) => j.name === job.name)) return false;
    job.waited = 0;
    this.jobs.push(job);
    return true;
  }

  has(name) { return this.jobs.some((j) => j.name === name); }

  remove(name) {
    const i = this.jobs.findIndex((j) => j.name === name);
    if (i >= 0) this.jobs.splice(i, 1);
  }

  get busy() { return this.jobs.length > 0; }

  // Do work until `budgetMs` has been spent. At least one piece is always done
  // if there is any, so a piece dearer than the budget still gets finished.
  // Returns how many pieces ran.
  run(budgetMs) {
    const jobs = this.jobs;
    const t0 = now();
    let steps = 0;
    if (jobs.length) jobs.sort((a, b) => b.priority - a.priority);
    while (jobs.length && (steps === 0 || now() - t0 < budgetMs) && steps < 400) {
      let j = jobs[0];
      for (let k = 1; k < jobs.length; k++) if (jobs[k].waited >= this.maxWait) { j = jobs[k]; break; }
      const done = j.step();
      for (let k = 0; k < jobs.length; k++) jobs[k].waited = jobs[k] === j ? 0 : jobs[k].waited + 1;
      if (done) jobs.splice(jobs.indexOf(j), 1);
      steps++;
    }
    this.lastMs = now() - t0;
    this.lastSteps = steps;
    return steps;
  }
}
