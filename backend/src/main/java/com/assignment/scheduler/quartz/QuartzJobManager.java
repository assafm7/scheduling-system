package com.assignment.scheduler.quartz;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import org.springframework.stereotype.Component;

import com.assignment.scheduler.common.Json;
import com.assignment.scheduler.scheduling.Scheduling;
import com.assignment.scheduler.scheduling.SchedulingStatus;

/**
 * Keeps one Quartz job + trigger per scheduling. With the JDBC job store, Spring's
 * {@code LocalDataSourceJobStore} enlists these calls in the caller's transaction, so the scheduling row and
 * its Quartz state commit or roll back together.
 */
@Component
public class QuartzJobManager {

	static final String GROUP = "schedulings";

	private final Scheduler scheduler;

	private final TriggerFactory triggerFactory;

	public QuartzJobManager(Scheduler scheduler, TriggerFactory triggerFactory) {
		this.scheduler = scheduler;
		this.triggerFactory = triggerFactory;
	}

	/** Creates or replaces the job and trigger for the scheduling, pausing it when disabled. */
	public void schedule(Scheduling scheduling) {
		String id = scheduling.getId().toString();
		JobDetail job = JobBuilder.newJob(TaskExecutionJob.class)
			.withIdentity(jobKey(scheduling.getId()))
			.withDescription(scheduling.getName())
			.usingJobData(TaskExecutionJob.SCHEDULING_ID, id)
			.usingJobData(TaskExecutionJob.TASK_KEY, scheduling.getTaskKey())
			.usingJobData(TaskExecutionJob.PARAMETERS, Json.write(scheduling.getParameters()))
			// durable: the job survives its trigger completing, so a finished one-time scheduling can be edited.
			.storeDurably()
			.build();
		Trigger trigger = triggerFactory.build(scheduling.getSchedule(), triggerKey(scheduling.getId()));
		try {
			scheduler.scheduleJob(job, Set.of(trigger), true);
			if (!scheduling.isEnabled()) {
				scheduler.pauseJob(job.getKey());
			}
		}
		catch (SchedulerException ex) {
			throw new SchedulingEngineException("Could not schedule " + id, ex);
		}
	}

	public void delete(UUID schedulingId) {
		try {
			scheduler.deleteJob(jobKey(schedulingId));
		}
		catch (SchedulerException ex) {
			throw new SchedulingEngineException("Could not delete job " + schedulingId, ex);
		}
	}

	public JobState state(UUID schedulingId) {
		try {
			List<? extends Trigger> triggers = scheduler.getTriggersOfJob(jobKey(schedulingId));
			if (triggers.isEmpty()) {
				return new JobState(SchedulingStatus.COMPLETED, null);
			}
			Trigger trigger = triggers.getFirst();
			if (scheduler.getTriggerState(trigger.getKey()) == Trigger.TriggerState.PAUSED) {
				return new JobState(SchedulingStatus.PAUSED, null);
			}
			return trigger.getNextFireTime() == null ? new JobState(SchedulingStatus.COMPLETED, null)
					: new JobState(SchedulingStatus.ACTIVE, trigger.getNextFireTime().toInstant());
		}
		catch (SchedulerException ex) {
			throw new SchedulingEngineException("Could not read job state " + schedulingId, ex);
		}
	}

	public boolean exists(UUID schedulingId) {
		try {
			return scheduler.checkExists(jobKey(schedulingId));
		}
		catch (SchedulerException ex) {
			throw new SchedulingEngineException("Could not check job " + schedulingId, ex);
		}
	}

	static JobKey jobKey(UUID schedulingId) {
		return JobKey.jobKey(schedulingId.toString(), GROUP);
	}

	static TriggerKey triggerKey(UUID schedulingId) {
		return TriggerKey.triggerKey(schedulingId.toString(), GROUP);
	}
}
