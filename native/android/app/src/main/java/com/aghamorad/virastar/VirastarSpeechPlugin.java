package com.aghamorad.virastar;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

// Dictation for the editor. Android's WebView exposes no Web Speech API, so the
// web app asks this plugin (window.Capacitor.Plugins.VirastarSpeech) to run the
// system recognizer instead. Emits `partialResult` events while listening and
// one `end` event when the session finishes — matching the iOS plugin.

@CapacitorPlugin(
    name = "VirastarSpeech",
    permissions = {
        @Permission(alias = "recordAudio", strings = {Manifest.permission.RECORD_AUDIO})
    }
)
public class VirastarSpeechPlugin extends Plugin {
    private SpeechRecognizer speechRecognizer;

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("تشخیص گفتار در دسترس نیست");
            return;
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("recordAudio", call, "permissionCallback");
            return;
        }
        beginListening(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getPermissionState(Manifest.permission.RECORD_AUDIO) == PermissionState.GRANTED) {
            beginListening(call);
        } else {
            call.reject("دسترسی به میکروفون داده نشد");
        }
    }

    private void beginListening(PluginCall call) {
        teardown();
        final SpeechRecognizer recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
        speechRecognizer = recognizer;
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {}

            @Override
            public void onBeginningOfSpeech() {}

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {}

            @Override
            public void onError(int error) {
                notifyListeners("end", new JSObject().put("error", "error-" + error));
                teardown();
            }

            @Override
            public void onResults(Bundle results) {
                List<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                notifyListeners("partialResult", new JSObject().put("transcript", text).put("isFinal", true));
                notifyListeners("end", new JSObject().put("error", ""));
                teardown();
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                List<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                notifyListeners("partialResult", new JSObject().put("transcript", text).put("isFinal", false));
            }

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fa-IR");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizer.startListening(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        SpeechRecognizer r = speechRecognizer;
        if (r != null) {
            r.stopListening();
        }
        teardown();
        notifyListeners("end", new JSObject().put("error", ""));
        call.resolve();
    }

    private void teardown() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }
}
