package com.assignment.scheduler.quartz;

import java.util.Map;
import java.util.UUID;

import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import com.assignment.scheduler.common.Json;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskContext;
import com.assignment.scheduler.task.TaskRegistry;

/**
 * The single Quartz job type: looks up the scheduling's task and runs it with the parameters stored in the job
 * data. Failures are logged and contained so one broken task cannot affect the scheduler or other jobs.
 */
@DisallowConcurrentExecution
public class TaskExecutionJob implements Job {

	static final String SCHEDULING_ID = "schedulingId";

	static final String TASK_KEY = "taskKey";

	static final String PARAMETERS = "parameters";

	private static final Logger log = LoggerFactory.getLogger(TaskExecutionJob.class);

	private final TaskRegistry taskRegistry;

	public TaskExecutionJob(TaskRegistry taskRegistry) {
		this.taskRegistry = taskRegistry;
	}

	@Override
	public void execute(JobExecutionContext context) throws JobExecutionException {
		JobDataMap data = context.getMergedJobDataMap();
		String schedulingId = data.getString(SCHEDULING_ID);
		String taskKey = data.getString(TASK_KEY);
		MDC.put(SCHEDULING_ID, schedulingId);
		MDC.put(TASK_KEY, taskKey);
		long started = System.nanoTime();
		try {
			ScheduledTask task = taskRegistry.find(taskKey)
				.orElseThrow(() -> new IllegalStateException("Unknown task '" + taskKey + "'"));
			Map<String, Object> parameters = Json.readMap(data.getString(PARAMETERS));
			task.execute(new TaskContext(UUID.fromString(schedulingId), parameters));
			log.info("Scheduling {} ran task {} in {} ms", schedulingId, taskKey, (System.nanoTime() - started) / 1_000_000);
		}
		catch (Exception ex) {
			log.error("Scheduling {} failed running task {}", schedulingId, taskKey, ex);
			// refireImmediately=false: never retry in a tight loop; the next scheduled fire proceeds as normal.
			throw new JobExecutionException(ex, false);
		}
		finally {
			MDC.remove(SCHEDULING_ID);
			MDC.remove(TASK_KEY);
		}
	}
}
