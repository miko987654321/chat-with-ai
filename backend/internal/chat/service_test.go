package chat

import "testing"

func TestIsAllowedModel(t *testing.T) {
	s := NewService(nil, nil, Options{
		AllowedModels: []string{"a:free", "b:free"},
	})
	if !s.IsAllowedModel("a:free") {
		t.Error("expected a:free to be allowed")
	}
	if s.IsAllowedModel("c:free") {
		t.Error("expected c:free to be rejected")
	}
}

func TestIsAllowedModelEmptyMeansAll(t *testing.T) {
	s := NewService(nil, nil, Options{})
	if !s.IsAllowedModel("anything:free") {
		t.Error("empty allow list should accept anything")
	}
}
