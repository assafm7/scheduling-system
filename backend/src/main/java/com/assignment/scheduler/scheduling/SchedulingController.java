package com.assignment.scheduler.scheduling;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/schedulings")
public class SchedulingController {

	private final SchedulingService service;

	public SchedulingController(SchedulingService service) {
		this.service = service;
	}

	@GetMapping
	public List<SchedulingResponse> list() {
		return service.findAll();
	}

	@GetMapping("/{id}")
	public SchedulingResponse get(@PathVariable UUID id) {
		return service.get(id);
	}

	@PostMapping
	public ResponseEntity<SchedulingResponse> create(@Valid @RequestBody SchedulingRequest request) {
		SchedulingResponse created = service.create(request);
		return ResponseEntity.created(URI.create("/api/schedulings/" + created.id())).body(created);
	}

	@PutMapping("/{id}")
	public SchedulingResponse update(@PathVariable UUID id, @Valid @RequestBody SchedulingRequest request) {
		return service.update(id, request);
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable UUID id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}

	/** Validates a schedule and returns its next fire times, without saving anything. */
	@PostMapping("/preview")
	public PreviewResponse preview(@RequestBody ScheduleSpec schedule) {
		return service.preview(schedule);
	}
}
